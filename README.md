# 📚 Library Events - Bay Area

A real-time library event aggregator that scrapes events from Bay Area public library websites.

## ✨ Features

- **Real-time event scraping** from library websites (no fake data!)
- **Interactive map** showing nearby libraries
- **Location-based search** - finds libraries within your chosen radius
- **Event filtering** by date, event type
- **Calendar & list views**
- **Direct links** to library event pages for registration

## 🏛️ Supported Libraries

| Library | Data Source | Status |
|---------|-------------|--------|
| Palo Alto City Library | BiblioCommons | ✅ Live |
| San Jose MLK Jr. Library | BiblioCommons | ✅ Live |
| Santa Clara City Library | BiblioCommons | ✅ Live |
| Mountain View Library | LibCal | ✅ Live |

More libraries coming soon!

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React App     │────▶│  Vercel API     │────▶│ Library Sites   │
│   (Vite + TW)   │     │  (Serverless)   │     │ (BiblioCommons/ │
└─────────────────┘     └─────────────────┘     │  LibCal)        │
                                                 └─────────────────┘
```

### Components

1. **Frontend** (`src/App.jsx`)
   - React + Vite + Tailwind CSS
   - Leaflet maps for location display
   - date-fns for date handling
   - Client-side caching (5 minutes)

2. **Backend API** (`api/events.js`)
   - Vercel Serverless Function
   - Fetches and parses library event pages
   - Returns normalized JSON event data

3. **Local Development Server** (`server.js`)
   - Standalone Node.js server for local testing
   - Same parsing logic as Vercel functions

## 🚀 Development

```bash
# Install dependencies
npm install

# Run both frontend and API server
npm run dev:full

# Or run separately:
npm run dev      # Frontend only (port 5173)
npm run server   # API server only (port 3001)
```

## 📦 Deployment

Deploy to Vercel:

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Deploy to production
vercel --prod
```

The app will be available at your Vercel URL with the API automatically configured.

## 🔧 API Endpoints

### GET `/api/events?library={id}`

Fetch events for a specific library.

**Parameters:**
- `library` (required): Library ID(s), comma-separated
  - `palo-alto` - Palo Alto City Library
  - `san-jose` - San Jose MLK Jr. Library
  - `santa-clara` - Santa Clara City Library
  - `mountain-view` - Mountain View Library

**Response:**
```json
{
  "success": true,
  "totalEvents": 15,
  "libraries": [
    { "id": "palo-alto", "name": "Palo Alto City Library", "eventCount": 15 }
  ],
  "events": [
    {
      "id": "palo-alto-1",
      "title": "Family Storytime",
      "type": "Story Time",
      "date": "2026-02-20T11:00:00.000Z",
      "duration": 60,
      "description": "...",
      "location": "Mitchell Park Library",
      "url": "https://paloalto.bibliocommons.com/events/..."
    }
  ]
}
```

## 🛠️ Adding New Libraries

1. Add library config to `LIBRARY_CONFIGS` in `api/events.js` and `server.js`
2. If the library uses a new platform (not BiblioCommons/LibCal), add a new parser
3. Add the library to `ALL_LIBRARIES` in `src/App.jsx` with `hasRealEvents: true`

## 📝 License

MIT - Built with 🐣 by Tiny
