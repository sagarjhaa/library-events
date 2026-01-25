import { useState, useMemo, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet'
import L from 'leaflet'
import { format, isToday, isTomorrow, isThisWeek, addDays } from 'date-fns'

// Fix for default marker icons in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// All available libraries (expanded list)
const ALL_LIBRARIES = [
  { id: 1, name: 'San Francisco Main Library', address: '100 Larkin St, San Francisco, CA 94102', lat: 37.7793, lng: -122.4157, color: '#dc2626', phone: '(415) 557-4400' },
  { id: 2, name: 'Oakland Public Library', address: '125 14th St, Oakland, CA 94612', lat: 37.8044, lng: -122.2712, color: '#2563eb', phone: '(510) 238-3134' },
  { id: 3, name: 'Berkeley Public Library', address: '2090 Kittredge St, Berkeley, CA 94704', lat: 37.8693, lng: -122.2689, color: '#16a34a', phone: '(510) 981-6100' },
  { id: 4, name: 'Palo Alto City Library', address: '1213 Newell Rd, Palo Alto, CA 94303', lat: 37.4419, lng: -122.1430, color: '#9333ea', phone: '(650) 329-2436' },
  { id: 5, name: 'San Jose MLK Jr. Library', address: '150 E San Fernando St, San Jose, CA 95112', lat: 37.3355, lng: -121.8854, color: '#ea580c', phone: '(408) 808-2000' },
  { id: 6, name: 'Fremont Main Library', address: '2400 Stevenson Blvd, Fremont, CA 94538', lat: 37.5530, lng: -122.0058, color: '#0891b2', phone: '(510) 745-1400' },
  { id: 7, name: 'Sunnyvale Public Library', address: '665 W Olive Ave, Sunnyvale, CA 94086', lat: 37.3772, lng: -122.0357, color: '#be185d', phone: '(408) 730-7300' },
  { id: 8, name: 'Mountain View Library', address: '585 Franklin St, Mountain View, CA 94041', lat: 37.3908, lng: -122.0795, color: '#4f46e5', phone: '(650) 903-6337' },
  { id: 9, name: 'Redwood City Library', address: '1044 Middlefield Rd, Redwood City, CA 94063', lat: 37.4847, lng: -122.2281, color: '#059669', phone: '(650) 780-7018' },
  { id: 10, name: 'Daly City Public Library', address: '40 Wembley Dr, Daly City, CA 94015', lat: 37.6879, lng: -122.4702, color: '#7c3aed', phone: '(650) 991-8023' },
  { id: 11, name: 'Hayward Public Library', address: '888 C St, Hayward, CA 94541', lat: 37.6688, lng: -122.0808, color: '#db2777', phone: '(510) 881-7300' },
  { id: 12, name: 'Santa Clara City Library', address: '2635 Homestead Rd, Santa Clara, CA 95051', lat: 37.3382, lng: -121.9863, color: '#0d9488', phone: '(408) 615-2900' },
]

const EVENT_TYPES = {
  'Book Club': { icon: '📚', color: 'bg-amber-100 text-amber-800' },
  'Story Time': { icon: '🧒', color: 'bg-pink-100 text-pink-800' },
  'Workshop': { icon: '🛠️', color: 'bg-blue-100 text-blue-800' },
  'Author Talk': { icon: '✍️', color: 'bg-purple-100 text-purple-800' },
  'Movie Night': { icon: '🎬', color: 'bg-red-100 text-red-800' },
  'Tech Help': { icon: '💻', color: 'bg-green-100 text-green-800' },
  'Art & Crafts': { icon: '🎨', color: 'bg-indigo-100 text-indigo-800' },
  'Music': { icon: '🎵', color: 'bg-teal-100 text-teal-800' },
}

// Haversine formula to calculate distance between two points
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Generate events for libraries
const generateEvents = (libraries) => {
  const events = []
  const eventTemplates = [
    { title: 'Mystery Book Club', type: 'Book Club', duration: 90, description: 'Discussing "The Silent Patient" - bring your theories!' },
    { title: 'Toddler Story Time', type: 'Story Time', duration: 45, description: 'Interactive stories and songs for ages 2-4. Parents welcome!' },
    { title: 'Resume Writing Workshop', type: 'Workshop', duration: 120, description: 'Get help polishing your resume with career experts. Bring a laptop if you have one.' },
    { title: 'Local Author Reading', type: 'Author Talk', duration: 60, description: 'Meet local authors and hear excerpts from their latest works. Books available for purchase and signing.' },
    { title: 'Classic Film Friday', type: 'Movie Night', duration: 150, description: 'Screening of Casablanca with popcorn provided. Doors open 15 min early.' },
    { title: 'Senior Tech Help', type: 'Tech Help', duration: 60, description: 'One-on-one help with smartphones, tablets, and computers. Bring your device!' },
    { title: 'Kids Craft Corner', type: 'Art & Crafts', duration: 60, description: 'Make your own bookmarks and book covers! All materials provided. Ages 5-12.' },
    { title: 'Sci-Fi Book Club', type: 'Book Club', duration: 90, description: 'Exploring "Project Hail Mary" by Andy Weir. New members welcome!' },
    { title: 'Preschool Music Time', type: 'Music', duration: 30, description: 'Sing-along and rhythm instruments for little ones. Ages 2-5 with caregiver.' },
    { title: 'Digital Photography Basics', type: 'Workshop', duration: 90, description: 'Learn to take better photos with any camera or smartphone.' },
    { title: 'Teen Gaming Night', type: 'Workshop', duration: 120, description: 'Board games, card games, and video games for teens. Snacks provided!' },
    { title: 'Poetry Open Mic', type: 'Author Talk', duration: 75, description: 'Open mic poetry night - all skill levels welcome. Sign up starts at 6:30pm.' },
  ]
  
  let id = 1
  const today = new Date()
  
  libraries.forEach(library => {
    const numEvents = 6 + Math.floor(Math.random() * 5)
    const usedDays = new Set()
    
    for (let i = 0; i < numEvents; i++) {
      const template = eventTemplates[Math.floor(Math.random() * eventTemplates.length)]
      let dayOffset
      do {
        dayOffset = Math.floor(Math.random() * 14)
      } while (usedDays.has(dayOffset) && usedDays.size < 14)
      usedDays.add(dayOffset)
      
      const eventDate = addDays(today, dayOffset)
      const hour = 10 + Math.floor(Math.random() * 8)
      eventDate.setHours(hour, Math.random() > 0.5 ? 0 : 30, 0, 0)
      
      const totalSpots = 10 + Math.floor(Math.random() * 40)
      const registered = Math.floor(Math.random() * (totalSpots - 2))
      
      events.push({
        id: id++,
        ...template,
        libraryId: library.id,
        libraryName: library.name,
        libraryAddress: library.address,
        libraryPhone: library.phone,
        libraryColor: library.color,
        distance: library.distance,
        date: eventDate,
        spots: totalSpots,
        registered: registered,
      })
    }
  })
  
  return events.sort((a, b) => a.date - b.date)
}

const FILTERS = ['All', 'Today', 'Tomorrow', 'This Week']
const RADIUS_OPTIONS = [5, 10, 15, 25, 50]

function createLibraryIcon(color) {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

function createUserIcon() {
  return L.divIcon({
    className: 'custom-div-icon',
    html: `<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 0 3px rgba(59,130,246,0.3);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  })
}

function MapController({ center, zoom }) {
  const map = useMap()
  
  useEffect(() => {
    if (center) {
      map.flyTo(center, zoom || 12, { duration: 0.5 })
    }
  }, [center, zoom, map])
  
  return null
}

// Toast notification component
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500'
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-4 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-slide-up`}>
      <span className="text-xl">{icon}</span>
      <span className="font-medium">{message}</span>
      <button onClick={onClose} className="ml-2 text-white/80 hover:text-white">✕</button>
    </div>
  )
}

function LocationPrompt({ onAllow, onManual, onError }) {
  const [manualAddress, setManualAddress] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [error, setError] = useState(null)

  const handleAllowLocation = () => {
    setIsLocating(true)
    setError(null)
    
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser')
      setIsLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        onAllow({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        })
      },
      (err) => {
        setIsLocating(false)
        if (err.code === 1) {
          setError('Location access denied. Please enter your address manually.')
        } else {
          setError('Unable to get your location. Please enter it manually.')
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  const handleManualSearch = async () => {
    if (!manualAddress.trim()) return
    setIsSearching(true)
    setError(null)
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualAddress)}&limit=1`
      )
      const data = await response.json()
      
      if (data && data[0]) {
        onManual({
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          address: data[0].display_name
        })
      } else {
        setError('Location not found. Please try a different address or zip code.')
      }
    } catch (err) {
      setError('Error searching for location. Please check your internet connection.')
    }
    
    setIsSearching(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="text-6xl mb-6">📍</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Find Library Events Near You</h1>
        <p className="text-gray-500 mb-8">
          Share your location to discover events at nearby libraries
        </p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}
        
        <button
          onClick={handleAllowLocation}
          disabled={isLocating}
          className="w-full py-4 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 disabled:opacity-70"
        >
          {isLocating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              Locating...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Use My Location
            </>
          )}
        </button>
        
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-4 text-sm text-gray-400">or enter address</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <input
            type="text"
            value={manualAddress}
            onChange={(e) => setManualAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleManualSearch()}
            placeholder="Enter city, zip, or address..."
            className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleManualSearch}
            disabled={isSearching || !manualAddress.trim()}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            {isSearching ? (
              <div className="w-5 h-5 border-2 border-gray-400/30 border-t-gray-400 rounded-full animate-spin"></div>
            ) : 'Go'}
          </button>
        </div>
        
        <p className="mt-6 text-xs text-gray-400">
          We only use your location to find nearby libraries. Your location is never stored or shared.
        </p>
      </div>
    </div>
  )
}

function App() {
  const [userLocation, setUserLocation] = useState(null)
  const [showLocationPrompt, setShowLocationPrompt] = useState(true)
  const [radius, setRadius] = useState(15) // miles
  const [selectedLibrary, setSelectedLibrary] = useState(null)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [timeFilter, setTimeFilter] = useState('All')
  const [typeFilter, setTypeFilter] = useState('All')
  const [view, setView] = useState('list')
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
  }, [])

  // Get nearby libraries based on user location
  const nearbyLibraries = useMemo(() => {
    if (!userLocation) return []
    
    return ALL_LIBRARIES
      .map(library => ({
        ...library,
        distance: getDistance(userLocation.lat, userLocation.lng, library.lat, library.lng)
      }))
      .filter(library => library.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
  }, [userLocation, radius])

  // Generate events for nearby libraries
  const events = useMemo(() => {
    if (nearbyLibraries.length === 0) return []
    return generateEvents(nearbyLibraries)
  }, [nearbyLibraries])

  const handleLocationSuccess = (location) => {
    setUserLocation(location)
    setShowLocationPrompt(false)
  }

  const handleRegister = useCallback((event) => {
    // Open the library's event registration page via search
    const searchQuery = `${event.libraryName} events registration ${event.title}`
    const url = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
    window.open(url, '_blank')
    showToast('Opening library registration page...', 'info')
  }, [showToast])

  const handleCallLibrary = useCallback((event) => {
    window.location.href = `tel:${event.libraryPhone.replace(/[^0-9]/g, '')}`
  }, [])

  const handleShare = useCallback(async (event) => {
    const shareData = {
      title: event.title,
      text: `Check out "${event.title}" at ${event.libraryName} on ${format(event.date, 'EEEE, MMMM d')} at ${format(event.date, 'h:mm a')}!`,
      url: window.location.href
    }

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
        showToast('Shared successfully!', 'success')
      } else {
        // Fallback: copy to clipboard
        const text = `${shareData.title}\n${shareData.text}\n${shareData.url}`
        await navigator.clipboard.writeText(text)
        showToast('Event details copied to clipboard!', 'success')
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        // Try clipboard as last resort
        try {
          const text = `${event.title} at ${event.libraryName} - ${format(event.date, 'MMM d')} at ${format(event.date, 'h:mm a')}`
          await navigator.clipboard.writeText(text)
          showToast('Event details copied to clipboard!', 'success')
        } catch {
          showToast('Unable to share. Please try again.', 'error')
        }
      }
    }
  }, [showToast])

  const handleGetDirections = useCallback((library) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(library.address)}`
    window.open(url, '_blank')
  }, [])

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      if (selectedLibrary && event.libraryId !== selectedLibrary.id) return false
      if (timeFilter === 'Today' && !isToday(event.date)) return false
      if (timeFilter === 'Tomorrow' && !isTomorrow(event.date)) return false
      if (timeFilter === 'This Week' && !isThisWeek(event.date)) return false
      if (typeFilter !== 'All' && event.type !== typeFilter) return false
      return true
    })
  }, [events, selectedLibrary, timeFilter, typeFilter])

  const groupedByDate = useMemo(() => {
    const groups = {}
    filteredEvents.forEach(event => {
      const dateKey = format(event.date, 'yyyy-MM-dd')
      if (!groups[dateKey]) {
        groups[dateKey] = { date: event.date, events: [] }
      }
      groups[dateKey].events.push(event)
    })
    return Object.values(groups)
  }, [filteredEvents])

  const formatEventDate = (date) => {
    if (isToday(date)) return 'Today'
    if (isTomorrow(date)) return 'Tomorrow'
    return format(date, 'EEEE, MMM d')
  }

  if (showLocationPrompt) {
    return <LocationPrompt onAllow={handleLocationSuccess} onManual={handleLocationSuccess} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                📚 Library Events
              </h1>
              <p className="text-sm text-gray-500">
                {nearbyLibraries.length} libraries within {radius} miles
              </p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {/* Radius Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Radius:</span>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {RADIUS_OPTIONS.map(r => (
                    <option key={r} value={r}>{r} mi</option>
                  ))}
                </select>
              </div>
              
              {/* View Toggle */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setView('list')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    view === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📋 List
                </button>
                <button
                  onClick={() => setView('calendar')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    view === 'calendar' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  📅 Calendar
                </button>
              </div>
              
              {/* Change Location */}
              <button
                onClick={() => setShowLocationPrompt(true)}
                className="px-3 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg font-medium transition-colors"
              >
                📍 Change Location
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {nearbyLibraries.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-lg">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">No Libraries Found Nearby</h2>
            <p className="text-gray-500 mb-6">Try increasing the search radius or changing your location.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setRadius(Math.min(radius + 10, 50))}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Expand to {Math.min(radius + 10, 50)} miles
              </button>
              <button
                onClick={() => setShowLocationPrompt(true)}
                className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
              >
                Change Location
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Map Section */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-24">
                <div className="h-64 lg:h-80">
                  <MapContainer
                    center={[userLocation.lat, userLocation.lng]}
                    zoom={11}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapController 
                      center={selectedLibrary ? [selectedLibrary.lat, selectedLibrary.lng] : [userLocation.lat, userLocation.lng]} 
                      zoom={selectedLibrary ? 14 : 11}
                    />
                    
                    {/* User Location */}
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={createUserIcon()}>
                      <Popup>📍 Your Location</Popup>
                    </Marker>
                    
                    {/* Radius Circle */}
                    <Circle 
                      center={[userLocation.lat, userLocation.lng]}
                      radius={radius * 1609.34}
                      pathOptions={{ 
                        color: '#3b82f6', 
                        fillColor: '#3b82f6', 
                        fillOpacity: 0.05,
                        weight: 1
                      }}
                    />
                    
                    {/* Library Markers */}
                    {nearbyLibraries.map(library => (
                      <Marker
                        key={library.id}
                        position={[library.lat, library.lng]}
                        icon={createLibraryIcon(library.color)}
                        eventHandlers={{
                          click: () => setSelectedLibrary(
                            selectedLibrary?.id === library.id ? null : library
                          ),
                        }}
                      >
                        <Popup>
                          <div className="text-center min-w-[150px]">
                            <strong className="block mb-1">{library.name}</strong>
                            <span className="text-gray-500 text-sm block mb-2">{library.distance.toFixed(1)} mi away</span>
                            <button 
                              onClick={() => handleGetDirections(library)}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              Get Directions →
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
                
                {/* Library List */}
                <div className="p-4 border-t max-h-64 overflow-y-auto">
                  <h3 className="font-semibold text-gray-700 mb-3">Nearby Libraries</h3>
                  <div className="space-y-2">
                    {nearbyLibraries.map(library => {
                      const eventCount = events.filter(e => e.libraryId === library.id).length
                      return (
                        <button
                          key={library.id}
                          onClick={() => setSelectedLibrary(
                            selectedLibrary?.id === library.id ? null : library
                          )}
                          className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 ${
                            selectedLibrary?.id === library.id
                              ? 'bg-blue-50 ring-2 ring-blue-500'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div 
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: library.color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-gray-900 truncate text-sm">
                              {library.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {library.distance.toFixed(1)} mi · {eventCount} events
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  {selectedLibrary && (
                    <button
                      onClick={() => setSelectedLibrary(null)}
                      className="w-full mt-3 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      ✕ Show all libraries
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Events Section */}
            <div className="lg:col-span-2">
              {/* Filters */}
              {view !== 'myevents' && (
                <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex gap-2 flex-wrap">
                      {FILTERS.map(f => (
                        <button
                          key={f}
                          onClick={() => setTimeFilter(f)}
                          className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
                            timeFilter === f
                              ? 'bg-blue-600 text-white shadow-md'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="px-4 py-2 text-sm font-medium rounded-full bg-gray-100 text-gray-600 border-0 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="All">All Types</option>
                      {Object.keys(EVENT_TYPES).map(type => (
                        <option key={type} value={type}>{EVENT_TYPES[type].icon} {type}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {view !== 'myevents' && (
                <div className="mb-4 text-sm text-gray-500">
                  Showing {filteredEvents.length} events
                  {selectedLibrary && ` at ${selectedLibrary.name}`}
                </div>
              )}

              {/* Event List */}
              {view === 'list' && (
                <div className="space-y-6">
                  {groupedByDate.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center">
                      <div className="text-4xl mb-3">🔍</div>
                      <p className="text-gray-500">No events found. Try adjusting your filters.</p>
                    </div>
                  ) : (
                    groupedByDate.map(group => (
                      <div key={format(group.date, 'yyyy-MM-dd')}>
                        <h3 className="text-lg font-semibold text-gray-800 mb-3 sticky top-20 bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-2 z-10">
                          {formatEventDate(group.date)}
                        </h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                          {group.events.map(event => (
                            <div
                              key={event.id}
                              className="event-card bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-lg cursor-pointer"
                              onClick={() => setSelectedEvent(event)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="text-3xl">{EVENT_TYPES[event.type]?.icon}</div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-gray-900 truncate pr-16">{event.title}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${EVENT_TYPES[event.type]?.color}`}>
                                      {event.type}
                                    </span>
                                    <span className="text-xs text-gray-400">{format(event.date, 'h:mm a')}</span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.libraryColor }} />
                                    {event.libraryName}
                                    <span className="text-gray-300 mx-1">·</span>
                                    {event.distance.toFixed(1)} mi
                                  </div>
                                  <div className="mt-2 flex items-center justify-between">
                                    <span className="text-xs text-gray-400">{event.duration} min</span>
                                    <span className={`text-xs font-medium ${
                                      event.spots - event.registered < 5 ? 'text-red-500' : 'text-green-600'
                                    }`}>
                                      {event.spots - event.registered} spots left
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Calendar View */}
              {view === 'calendar' && (
                <div className="bg-white rounded-2xl shadow-sm p-6">
                  <div className="grid grid-cols-7 gap-2 text-center mb-4">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="text-sm font-medium text-gray-500">{day}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: 14 }, (_, i) => {
                      const date = addDays(new Date(), i)
                      const dayEvents = filteredEvents.filter(e => 
                        format(e.date, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                      )
                      return (
                        <div
                          key={i}
                          className={`min-h-24 p-2 rounded-lg border ${
                            isToday(date) ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          <div className={`text-sm font-medium mb-1 ${isToday(date) ? 'text-blue-600' : 'text-gray-700'}`}>
                            {format(date, 'd')}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 3).map(event => (
                              <div
                                key={event.id}
                                onClick={() => setSelectedEvent(event)}
                                className="text-xs p-1 rounded bg-white shadow-sm truncate cursor-pointer hover:shadow-md transition-shadow"
                                style={{ borderLeft: `3px solid ${event.libraryColor}` }}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 3 && (
                              <div className="text-xs text-gray-400 text-center">+{dayEvents.length - 3} more</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{EVENT_TYPES[selectedEvent.type]?.icon}</div>
                <button 
                  onClick={() => setSelectedEvent(null)} 
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                >
                  ×
                </button>
              </div>
              
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedEvent.title}</h2>
              
              <span className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${EVENT_TYPES[selectedEvent.type]?.color}`}>
                {selectedEvent.type}
              </span>
              
              <div className="mt-6 space-y-4">
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="text-xl">📅</span>
                  <div>
                    <div className="font-medium">{format(selectedEvent.date, 'EEEE, MMMM d, yyyy')}</div>
                    <div className="text-sm text-gray-400">{format(selectedEvent.date, 'h:mm a')} · {selectedEvent.duration} minutes</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="text-xl">📍</span>
                  <div className="flex-1">
                    <div className="font-medium">{selectedEvent.libraryName}</div>
                    <div className="text-sm text-gray-400">{selectedEvent.libraryAddress}</div>
                    <div className="text-sm text-gray-400">{selectedEvent.distance.toFixed(1)} miles away</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="text-xl">📞</span>
                  <div>
                    <div className="font-medium">{selectedEvent.libraryPhone}</div>
                    <div className="text-sm text-gray-400">Library phone</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-gray-600">
                  <span className="text-xl">👥</span>
                  <div>
                    <div className="font-medium">
                      {selectedEvent.spots - selectedEvent.registered} spots available
                    </div>
                    <div className="text-sm text-gray-400">{selectedEvent.registered} people registered</div>
                    {selectedEvent.spots - selectedEvent.registered < 5 && (
                      <div className="text-sm text-red-500 font-medium">Almost full!</div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-gray-50 rounded-xl">
                <h4 className="font-medium text-gray-900 mb-2">About this event</h4>
                <p className="text-gray-600 leading-relaxed">{selectedEvent.description}</p>
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-xl">
                <p className="text-sm text-blue-800 mb-3">
                  📋 To register, contact the library directly or visit their events page.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button 
                    onClick={() => handleRegister(selectedEvent)}
                    className="flex-1 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Register Online
                  </button>
                  <button 
                    onClick={() => handleCallLibrary(selectedEvent)}
                    className="py-3 px-6 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    Call
                  </button>
                </div>
              </div>
              
              <div className="mt-4 flex gap-3">
                <button 
                  onClick={() => handleGetDirections({ address: selectedEvent.libraryAddress })}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Directions
                </button>
                <button 
                  onClick={() => handleShare(selectedEvent)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center py-8 text-sm text-gray-400">
        Built with 🐣 by Tiny
      </footer>
      
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </div>
  )
}

export default App
