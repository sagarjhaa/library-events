// Local development server for testing the API
import http from 'http';
import { URL } from 'url';

const LIBRARY_CONFIGS = {
  'palo-alto': {
    name: 'Palo Alto City Library',
    type: 'bibliocommons',
    subdomain: 'paloalto',
    apiUrl: 'https://gateway.bibliocommons.com/v2/libraries/paloalto/events',
    baseUrl: 'https://paloalto.bibliocommons.com'
  },
  'san-jose': {
    name: 'San Jose MLK Jr. Library',
    type: 'bibliocommons',
    subdomain: 'sjpl',
    apiUrl: 'https://gateway.bibliocommons.com/v2/libraries/sjpl/events',
    baseUrl: 'https://sjpl.bibliocommons.com'
  },
  'santa-clara': {
    name: 'Santa Clara City Library',
    type: 'bibliocommons',
    subdomain: 'sccl',
    apiUrl: 'https://gateway.bibliocommons.com/v2/libraries/sccl/events',
    baseUrl: 'https://sccl.bibliocommons.com'
  },
  'mountain-view': {
    name: 'Mountain View Library',
    type: 'libcal',
    calendarId: 'events',
    apiUrl: 'https://mountainview.libcal.com/1.1/events',
    baseUrl: 'https://mountainview.libcal.com'
  }
};

// Determine event type from title/description
function determineEventType(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes('storytime') || text.includes('story time') || text.includes('stories')) {
    return 'Story Time';
  } else if (text.includes('book club') || text.includes('book sale')) {
    return 'Book Club';
  } else if (text.includes('craft') || text.includes('art') || text.includes('origami') || text.includes('sew') || text.includes('create')) {
    return 'Art & Crafts';
  } else if (text.includes('tech') || text.includes('computer') || text.includes('tax') || text.includes('digital')) {
    return 'Tech Help';
  } else if (text.includes('movie') || text.includes('film') || text.includes('documentary') || text.includes('screening')) {
    return 'Movie Night';
  } else if (text.includes('author') || text.includes('reading') || text.includes('poetry') || text.includes('writer')) {
    return 'Author Talk';
  } else if (text.includes('music') || text.includes('concert') || text.includes('ukulele') || text.includes('jam') || text.includes('sing')) {
    return 'Music';
  }
  return 'Workshop';
}

// Strip HTML tags from description
function stripHtml(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

// Fetch events from BiblioCommons API
async function fetchBiblioCommonsEvents(config, libraryId) {
  const url = `${config.apiUrl}?locale=en-US&limit=50`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  const events = [];
  
  if (data.events?.items && data.entities?.events) {
    for (const eventId of data.events.items) {
      const eventData = data.entities.events[eventId];
      if (!eventData?.definition) continue;
      
      const def = eventData.definition;
      const startDate = new Date(def.start);
      const endDate = def.end ? new Date(def.end) : new Date(startDate.getTime() + 60 * 60 * 1000);
      
      // Skip past events
      if (startDate < new Date()) continue;
      
      const duration = Math.round((endDate - startDate) / (1000 * 60));
      const description = def.description ? stripHtml(def.description).slice(0, 300) : '';
      
      events.push({
        id: eventId,
        title: def.title,
        type: determineEventType(def.title, description),
        date: startDate.toISOString(),
        duration: duration,
        description: description || `Join us at ${config.name} for ${def.title}.`,
        location: def.locationDetails || config.name,
        libraryId: libraryId,
        url: `${config.baseUrl}/events/${eventId}`,
        categories: [],
        isFeatured: def.isFeatured || false
      });
    }
  }
  
  // Sort by date
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return events;
}

// Fetch events from LibCal API
async function fetchLibCalEvents(config, libraryId) {
  // LibCal has a different API structure
  // Try to get events from the calendar widget API
  const today = new Date();
  const startDate = today.toISOString().split('T')[0];
  const endDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // LibCal uses a widget API that requires specific parameters
  // For now, fall back to HTML scraping for LibCal
  const url = `${config.baseUrl}/`;
  
  const response = await fetch(url, {
    headers: {
      'Accept': 'text/html',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const html = await response.text();
  const events = [];
  
  // Parse events from LibCal HTML calendar
  // Look for event links in the calendar cells
  const eventPattern = /<a[^>]*href="(https:\/\/mountainview\.libcal\.com\/event\/(\d+))"[^>]*>([^<]*(?:am|pm)[^<]*)<\/a>/gi;
  const seenIds = new Set();
  let match;
  
  while ((match = eventPattern.exec(html)) !== null) {
    const url = match[1];
    const eventId = match[2];
    const rawText = match[3].trim();
    
    if (seenIds.has(eventId)) continue;
    seenIds.add(eventId);
    
    // Parse time and title (e.g., "10:30 amBaby Storytime")
    const timeTitle = rawText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))(.+)/i);
    
    if (timeTitle) {
      const timeStr = timeTitle[1].trim();
      const title = timeTitle[2].trim();
      
      const timeParts = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
      if (timeParts) {
        let hours = parseInt(timeParts[1]);
        const minutes = parseInt(timeParts[2] || '0');
        if (timeParts[3].toLowerCase() === 'pm' && hours !== 12) hours += 12;
        if (timeParts[3].toLowerCase() === 'am' && hours === 12) hours = 0;
        
        // Find date context - look for day number near this event
        const contextStart = Math.max(0, match.index - 200);
        const context = html.substring(contextStart, match.index);
        const dayMatch = context.match(/"(\d{1,2})"[^"]*$/);
        
        const eventDate = new Date(today);
        if (dayMatch) {
          eventDate.setDate(parseInt(dayMatch[1]));
          // If the day is earlier in the month, it's next month
          if (eventDate < today) {
            eventDate.setMonth(eventDate.getMonth() + 1);
          }
        }
        eventDate.setHours(hours, minutes, 0, 0);
        
        events.push({
          id: eventId,
          title: title,
          type: determineEventType(title),
          date: eventDate.toISOString(),
          duration: 60,
          description: `Join us at Mountain View Public Library for ${title}.`,
          location: 'Mountain View Public Library',
          libraryId: libraryId,
          url: url,
          categories: []
        });
      }
    }
  }
  
  // Sort by date
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return events;
}

async function fetchLibraryEvents(libraryId) {
  const config = LIBRARY_CONFIGS[libraryId];
  if (!config) {
    throw new Error(`Unknown library: ${libraryId}`);
  }
  
  let events;
  if (config.type === 'bibliocommons') {
    events = await fetchBiblioCommonsEvents(config, libraryId);
  } else if (config.type === 'libcal') {
    events = await fetchLibCalEvents(config, libraryId);
  } else {
    events = [];
  }
  
  return {
    library: config.name,
    libraryId: libraryId,
    events: events,
    fetchedAt: new Date().toISOString(),
    source: config.apiUrl || config.baseUrl
  };
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  if (url.pathname === '/api/events') {
    const library = url.searchParams.get('library');
    
    if (!library) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Missing library parameter',
        available: Object.keys(LIBRARY_CONFIGS)
      }));
      return;
    }
    
    const libraryIds = library.split(',').map(l => l.trim());
    
    try {
      const results = await Promise.all(
        libraryIds.map(async (id) => {
          try {
            return await fetchLibraryEvents(id);
          } catch (error) {
            console.error(`Error fetching ${id}:`, error.message);
            return {
              library: LIBRARY_CONFIGS[id]?.name || id,
              libraryId: id,
              events: [],
              error: error.message,
              fetchedAt: new Date().toISOString()
            };
          }
        })
      );
      
      const allEvents = results.flatMap(r => r.events);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        totalEvents: allEvents.length,
        libraries: results.map(r => ({
          id: r.libraryId,
          name: r.library,
          eventCount: r.events.length,
          error: r.error || null
        })),
        events: allEvents,
        fetchedAt: new Date().toISOString()
      }));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message
      }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 API server running at http://localhost:${PORT}`);
  console.log(`📚 Available endpoints:`);
  console.log(`   GET /api/events?library=palo-alto`);
  console.log(`   GET /api/events?library=san-jose`);
  console.log(`   GET /api/events?library=santa-clara`);
  console.log(`   GET /api/events?library=mountain-view`);
});
