// Vercel Serverless Function for scraping library events

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
    apiUrl: 'https://mountainview.libcal.com/',
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
  if (!html) return '';
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
      const description = stripHtml(def.description).slice(0, 300);
      
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
  
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return events;
}

// Fetch events from LibCal
async function fetchLibCalEvents(config, libraryId) {
  const url = config.apiUrl;
  
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
  const today = new Date();
  
  // Parse events from LibCal HTML calendar
  const eventPattern = /<a[^>]*href="(https:\/\/mountainview\.libcal\.com\/event\/(\d+))"[^>]*>([^<]*(?:am|pm)[^<]*)<\/a>/gi;
  const seenIds = new Set();
  let match;
  
  while ((match = eventPattern.exec(html)) !== null) {
    const eventUrl = match[1];
    const eventId = match[2];
    const rawText = match[3].trim();
    
    if (seenIds.has(eventId)) continue;
    seenIds.add(eventId);
    
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
        
        const contextStart = Math.max(0, match.index - 200);
        const context = html.substring(contextStart, match.index);
        const dayMatch = context.match(/"(\d{1,2})"[^"]*$/);
        
        const eventDate = new Date(today);
        if (dayMatch) {
          eventDate.setDate(parseInt(dayMatch[1]));
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
          url: eventUrl,
          categories: []
        });
      }
    }
  }
  
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
    source: config.apiUrl
  };
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { library } = req.query;
  
  if (!library) {
    return res.status(400).json({ 
      error: 'Missing library parameter',
      available: Object.keys(LIBRARY_CONFIGS)
    });
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
    
    return res.status(200).json({
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
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
