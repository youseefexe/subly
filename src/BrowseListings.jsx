import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from './supabase'
import { parseTags } from './utils'
import { SublyWordmark } from './Logo'
import ListingModal from './ListingModal'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const UMichIcon = L.divIcon({
  className: '',
  html: `<div style="background:#00274C;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.45),0 1px 4px rgba(0,0,0,0.3);border:3px solid #FFCB05;"><span style="font-size:20px;line-height:1;">🏠</span></div>`,
  iconSize: [44, 44], iconAnchor: [22, 44], popupAnchor: [0, -48],
})

const TAGS = ['Utilities included', 'In-unit washer/dryer', 'Parking included', 'Pet friendly', 'Furnished', 'A/C', 'Dishwasher', 'Gym access', 'Near bus line', 'Private bathroom', 'Short term ok', 'Bills split', 'Negotiable']
const NEIGHBORHOODS = ['Central Campus', 'North Campus', 'South Campus', 'Kerrytown', 'Burns Park', 'Old West Side', 'Downtown Ann Arbor', 'Near Northside', 'Water Hill', 'Other']

const getCoverImage = (raw) => {
  if (!raw) return null
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p[0] : raw } catch { return raw }
}

const geocodeAddress = async (address) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`, { headers: { 'Accept-Language': 'en' } })
    const data = await res.json()
    if (data.length > 0) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
  } catch (e) {}
  return null
}

const parseDate = (str) => {
  if (!str) return null
  const parts = str.split(' to ')
  if (parts.length < 2) return null
  return { start: new Date(parts[0]), end: new Date(parts[1]) }
}

function FilterPill({ label, active, onClear, children, dm }) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const btnRef = useRef(null)
  const dropRef = useRef(null)

  const handleToggle = () => {
    if (!open && btnRef.current) {
      setRect(btnRef.current.getBoundingClientRect())
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    const fn = e => {
      if (
        btnRef.current && !btnRef.current.contains(e.target) &&
        dropRef.current && !dropRef.current.contains(e.target)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [open])

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={btnRef}
        onClick={handleToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 980,
          border: `1.5px solid ${active ? '#00274C' : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,39,76,0.15)')}`,
          background: active ? '#00274C' : (dm ? '#2c2c2e' : '#fff'),
          color: active ? '#FFCB05' : (dm ? '#f5f5f7' : '#1d1d1f'),
          fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
          cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
          boxShadow: open ? '0 4px 16px rgba(0,0,0,0.2)' : 'none',
        }}>
        {label}
        {active && <span onClick={e => { e.stopPropagation(); onClear() }} style={{ marginLeft: 2, opacity: 0.7, fontSize: 14, lineHeight: 1 }}>×</span>}
        {!active && <span style={{ fontSize: 10, opacity: 0.4, marginLeft: 2 }}>{open ? '▲' : '▼'}</span>}
      </button>
      {open && rect && createPortal(
        <div
          ref={dropRef}
          style={{
            position: 'fixed',
            top: rect.bottom + 8,
            left: rect.left,
            zIndex: 99999,
            background: dm ? '#1c1c1e' : '#fff', borderRadius: 16,
            border: `1px solid ${dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
            boxShadow: '0 16px 48px rgba(0,0,0,0.25)', padding: 20, minWidth: 240,
            animation: 'pop-in 0.15s ease',
          }}>
          {children}
          <button onClick={() => setOpen(false)} style={{ marginTop: 16, width: '100%', background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Apply
          </button>
        </div>,
        document.body
      )}
    </div>
  )
}

function MapTooltip({ listing, latLng, dm }) {
  const map = useMap()
  const [pos, setPos] = useState(null)

  useEffect(() => {
    if (!listing || !latLng) { setPos(null); return }
    const update = () => {
      const pt = map.latLngToContainerPoint(latLng)
      const rect = map.getContainer().getBoundingClientRect()
      setPos({ x: rect.left + pt.x, y: rect.top + pt.y })
    }
    update()
    map.on('move zoom moveend zoomend', update)
    return () => { map.off('move zoom moveend zoomend', update) }
  }, [listing, latLng, map])

  if (!listing || !pos) return null

  const cover = (() => {
    const raw = listing.image_url
    if (!raw) return null
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p[0] : raw } catch { return raw }
  })()

  // pos.y is the marker anchor (bottom of the 44px icon).
  // We position the tooltip's bottom edge just above the icon top (pos.y - 44 - 8).
  return createPortal(
    <div style={{
      position: 'fixed',
      left: pos.x,
      top: pos.y - 44 - 8,
      transform: 'translate(-50%, -100%)',
      zIndex: 99999,
      pointerEvents: 'none',
      fontFamily: 'Inter, sans-serif',
      animation: 'pop-in 0.15s ease',
    }}>
      <div style={{
        background: dm ? '#1c1c1e' : '#fff',
        borderRadius: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.1)',
        border: `1px solid ${dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)'}`,
        overflow: 'hidden',
        width: 220,
      }}>
        {cover && (
          <img src={cover} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: dm ? '#f5f5f7' : '#1d1d1f', marginBottom: 5, lineHeight: 1.3 }}>
            {listing.title || 'Untitled Listing'}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: dm ? '#FFCB05' : '#00274C', letterSpacing: '-0.03em', marginBottom: 3 }}>
            ${Number(listing.price).toLocaleString()}
            <span style={{ fontSize: 12, fontWeight: 500, color: dm ? '#636366' : '#aeaeb2', marginLeft: 2 }}>/mo</span>
          </div>
          {listing.beds && (
            <div style={{ fontSize: 12, color: dm ? '#8e8e93' : '#6e6e73' }}>{listing.beds}</div>
          )}
        </div>
      </div>
      {/* Down-pointing arrow */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{
          width: 0, height: 0,
          borderLeft: '9px solid transparent',
          borderRight: '9px solid transparent',
          borderTop: `9px solid ${dm ? '#1c1c1e' : '#fff'}`,
        }} />
      </div>
    </div>,
    document.body
  )
}

export default function BrowseListings({ onBack, onPost, onDashboard, currentUser, initialModal, onModalClear, darkMode, onToggleDark, onSignIn, filterUserId }) {
  const dm = darkMode
  const [listings, setListings] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalListing, setModalListing] = useState(null)
  const [view, setView] = useState('split')
  const [search, setSearch] = useState('')
  const [geocoded, setGeocoded] = useState({})
  const [beds, setBeds] = useState('Any')
  const [maxPrice, setMaxPrice] = useState(3000)
  const [priceActive, setPriceActive] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [neighborhood, setNeighborhood] = useState('Any')
  const [hideFilled, setHideFilled] = useState(false)
  const [hoveredListing, setHoveredListing] = useState(null)
  const [hoveredLatLng, setHoveredLatLng] = useState(null)
  const [expandedBuildings, setExpandedBuildings] = useState(new Set())
  const MAX_SLIDER = 3000

  useEffect(() => { fetchListings() }, [filterUserId])
  useEffect(() => { if (initialModal) { setModalListing(initialModal); if (onModalClear) onModalClear() } }, [initialModal])
  useEffect(() => {
    if (window.innerWidth <= 390) setView('list')
  }, [])

  const fetchListings = async () => {
    setLoading(true)
    let query = supabase.from('listings').select('*')
    if (filterUserId) query = query.eq('user_id', filterUserId)
    const { data, error } = await query
    if (!error && data) { setListings(data); setFiltered(data); geocodeAll(data) }
    setLoading(false)
  }

  const geocodeAll = async (data) => {
    const coords = {}
    for (const listing of data) {
      if (listing.address) {
        const result = await geocodeAddress(listing.address)
        if (result) coords[listing.id] = result
        await new Promise(r => setTimeout(r, 200))
      }
    }
    setGeocoded(coords)
  }

  const toggleTag = tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  useEffect(() => {
    let result = [...listings]
    if (search) result = result.filter(l => l.title?.toLowerCase().includes(search.toLowerCase()) || l.address?.toLowerCase().includes(search.toLowerCase()) || l.building_name?.toLowerCase().includes(search.toLowerCase()))
    if (beds !== 'Any') result = result.filter(l => l.beds === beds)
    if (priceActive) result = result.filter(l => l.price <= maxPrice)
    if (dateFrom) {
      const from = new Date(dateFrom)
      result = result.filter(l => { const d = parseDate(l.dates); return d && d.start <= from && d.end >= from })
    }
    if (dateTo) {
      const to = new Date(dateTo)
      result = result.filter(l => { const d = parseDate(l.dates); return d && d.end >= to })
    }
    if (selectedTags.length > 0) {
      result = result.filter(l => {
        const lt = parseTags(l.tags)
        return selectedTags.every(t => lt.includes(t))
      })
    }
    if (neighborhood !== 'Any') result = result.filter(l => l.neighborhood === neighborhood)
    if (hideFilled) result = result.filter(l => !l.filled)
    setFiltered(result)
  }, [search, beds, maxPrice, priceActive, dateFrom, dateTo, selectedTags, neighborhood, hideFilled, listings])

  const clearAll = () => { setBeds('Any'); setMaxPrice(3000); setPriceActive(false); setDateFrom(''); setDateTo(''); setSelectedTags([]); setNeighborhood('Any'); setHideFilled(false) }
  const toggleBuilding = (name) => setExpandedBuildings(prev => {
    const next = new Set(prev)
    next.has(name) ? next.delete(name) : next.add(name)
    return next
  })
  const anyActive = beds !== 'Any' || priceActive || dateFrom || dateTo || selectedTags.length > 0 || neighborhood !== 'Any' || hideFilled
  const mapCenter = [42.2808, -83.7430]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; overflow: hidden; }
        @keyframes pop-in { from { opacity: 0; transform: translateY(-6px) scale(0.97); } to { opacity: 1; transform: none; } }
        .listing-tile { background: #fff; border-radius: 16px; border: 1.5px solid rgba(0,0,0,0.07); overflow: hidden; cursor: pointer; transition: all 0.25s ease; }
        .listing-tile:hover { box-shadow: 0 12px 36px rgba(0,39,76,0.13); transform: translateY(-3px); border-color: rgba(0,39,76,0.15); }
        .view-btn { background: transparent; border: none; width: 34px; height: 34px; border-radius: 8px; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: background 0.15s; color: #6e6e73; }
        .view-btn:hover { background: rgba(0,0,0,0.05); color: #1d1d1f; }
        .view-btn.active { background: #00274C; color: #FFCB05; }
        .search-input { flex: 1; border: none; outline: none; font-size: 14px; font-family: inherit; color: #1d1d1f; background: transparent; }
        .search-input::placeholder { color: #aeaeb2; }
        .pill { font-size: 11px; color: #6e6e73; background: #f5f5f7; padding: 3px 9px; border-radius: 980px; }
        .pill-gold { background: rgba(255,203,5,0.15); color: #7a5c00; font-weight: 500; }
        .pill-green { background: rgba(52,199,89,0.1); color: #1a8c39; font-weight: 500; }
        .pill-blue { background: rgba(0,39,76,0.07); color: #00274C; font-weight: 500; }
        .bed-opt { width: 100%; padding: 9px 12px; text-align: left; background: none; border: 1.5px solid rgba(0,0,0,0.08); border-radius: 10px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; color: #1d1d1f; transition: all 0.15s; margin-bottom: 6px; }
        .bed-opt:hover { border-color: #00274C; background: rgba(0,39,76,0.03); }
        .bed-opt.active { background: #00274C; color: #FFCB05; border-color: #00274C; }
        .tag-chip { padding: 6px 12px; border-radius: 980px; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: 1.5px solid rgba(0,0,0,0.08); background: #fff; color: #6e6e73; font-family: inherit; }
        .tag-chip:hover { border-color: #00274C; }
        .tag-chip.active { background: #00274C; color: #FFCB05; border-color: #00274C; }
        .price-slider { -webkit-appearance: none; width: 100%; height: 4px; border-radius: 2px; outline: none; cursor: pointer; background: transparent; }
        .price-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: #00274C; border: 3px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.2); cursor: pointer; transition: transform 0.15s; }
        .price-slider::-webkit-slider-thumb:hover { transform: scale(1.15); }
        [data-theme="dark"] .price-slider::-webkit-slider-thumb { background: #FFCB05; border-color: #1c1c1e; }
        .date-input { width: 100%; border: 1.5px solid rgba(0,39,76,0.12); border-radius: 10px; padding: 9px 12px; font-size: 13px; font-family: inherit; color: #1d1d1f; outline: none; transition: border-color 0.2s; background: #fff; }
        .date-input:focus { border-color: #00274C; }
        .leaflet-container { height: 100%; width: 100%; }
        .listing-tile.map-hovered { border-color: #00274C !important; box-shadow: 0 0 0 2px rgba(0,39,76,0.15), 0 12px 36px rgba(0,39,76,0.13) !important; background: rgba(0,39,76,0.02) !important; transform: translateY(-3px) !important; }
        [data-theme="dark"] .listing-tile.map-hovered { border-color: #FFCB05 !important; box-shadow: 0 0 0 2px rgba(255,203,5,0.25), 0 12px 36px rgba(0,0,0,0.4) !important; background: rgba(255,203,5,0.03) !important; }
        .leaflet-popup-tip { display: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
        .dark-toggle { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; border: 1.5px solid; }
        .dark-toggle:hover { transform: scale(1.1); }
        .browse-avatar { transition: transform 0.2s ease, box-shadow 0.15s !important; }
        .browse-avatar:hover { transform: scale(1.08) !important; }
        .filter-bar::-webkit-scrollbar { display: none; }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        [data-theme="dark"] .skeleton {
          background: linear-gradient(90deg, #2c2c2e 25%, #3a3a3c 50%, #2c2c2e 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s ease infinite;
        }
        .building-card { background: #fff; border-radius: 16px; border: 2px solid rgba(0,39,76,0.14); overflow: hidden; transition: box-shadow 0.2s; }
        .building-card:hover { box-shadow: 0 8px 28px rgba(0,39,76,0.1); }
        .building-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; cursor: pointer; transition: background 0.15s; }
        .building-header:hover { background: rgba(0,39,76,0.025); }
        [data-theme="dark"] .building-card { background: #1c1c1e; border-color: rgba(255,203,5,0.18); }
        [data-theme="dark"] .building-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.4); }
        [data-theme="dark"] .building-header:hover { background: rgba(255,203,5,0.04); }
        .filter-bar-wrap { position: relative; }
        .filter-bar-wrap::after { content: ''; position: absolute; right: 0; top: 0; bottom: 0; width: 48px; background: linear-gradient(to left, #fff 0%, rgba(255,255,255,0) 100%); pointer-events: none; z-index: 1; }
        [data-theme="dark"] .filter-bar-wrap::after { background: linear-gradient(to left, #1c1c1e 0%, rgba(28,28,30,0) 100%); }
        [data-theme="dark"] body { background: #0f0f11; }
        [data-theme="dark"] .listing-tile { background: #1c1c1e; border-color: rgba(255,255,255,0.08); }
        [data-theme="dark"] .listing-tile:hover { box-shadow: 0 12px 36px rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.14); }
        [data-theme="dark"] .view-btn { color: #8e8e93; }
        [data-theme="dark"] .view-btn:hover { background: rgba(255,255,255,0.07); color: #f5f5f7; }
        [data-theme="dark"] .view-btn.active { background: #FFCB05; color: #00274C; }
        [data-theme="dark"] .search-input { color: #f5f5f7; }
        [data-theme="dark"] .search-input::placeholder { color: #636366; }
        [data-theme="dark"] .pill { background: #2c2c2e; color: #8e8e93; }
        [data-theme="dark"] .pill-gold { color: #FFCB05; }
        [data-theme="dark"] .pill-blue { background: rgba(255,203,5,0.1); color: #FFCB05; }
        [data-theme="dark"] .bed-opt { border-color: rgba(255,255,255,0.1); color: #f5f5f7; }
        [data-theme="dark"] .bed-opt:hover { background: rgba(255,255,255,0.05); }
        [data-theme="dark"] .tag-chip { background: #2c2c2e; color: #8e8e93; border-color: rgba(255,255,255,0.1); }
        [data-theme="dark"] .date-input { background: #2c2c2e; color: #f5f5f7; border-color: rgba(255,255,255,0.1); }
        @media (max-width: 640px) {
          .browse-nav { padding: 0 16px !important; }
          .browse-right { gap: 8px !important; }
          .browse-view-toggle { display: none !important; }
          .browse-avatar { display: none !important; }
        }
        @media (max-width: 390px) {
          .browse-search { margin: 0 10px !important; }
          .filter-bar { padding: 10px 12px !important; }
          .filter-bar::-webkit-scrollbar { display: none !important; }
          .listings-panel { width: 100% !important; }
        }
      `}</style>

      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: dm ? '#0f0f11' : '#f5f5f7' }}>

        {/* NAV */}
        <nav className="browse-nav" style={{ background: dm ? '#1c1c1e' : '#fff', borderBottom: `1px solid ${dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, padding: '0 28px', height: 64, display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0, zIndex: 50 }}>
          {/* Left — logo */}
          <SublyWordmark size={26} onClick={onBack} light={dm} />

          {/* Center — search */}
          <div className="browse-search" style={{ flex: 1, background: dm ? '#2c2c2e' : '#f5f5f7', border: `1.5px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`, borderRadius: 980, padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 10, transition: 'border-color 0.15s', maxWidth: 560 }}>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, color: dm ? '#636366' : '#aeaeb2' }}>
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className="search-input"
              placeholder="Search by title or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: 14 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: dm ? '#636366' : '#aeaeb2', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}>×</button>
            )}
          </div>

          {/* Right — view toggle, post, avatar */}
          <div className="browse-right" style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, marginLeft: 'auto' }}>
            {/* View toggle */}
            <div className="browse-view-toggle" style={{ display: 'flex', background: dm ? '#2c2c2e' : '#f0f0f2', borderRadius: 10, padding: 3, gap: 2 }}>
              {[
                ['split', <svg key="s" width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="1" width="5.5" height="13" rx="1.5" fill="currentColor"/><rect x="8.5" y="1" width="5.5" height="13" rx="1.5" fill="currentColor"/></svg>],
                ['list', <svg key="l" width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="1" y="2" width="13" height="2" rx="1" fill="currentColor"/><rect x="1" y="6.5" width="13" height="2" rx="1" fill="currentColor"/><rect x="1" y="11" width="13" height="2" rx="1" fill="currentColor"/></svg>],
                ['map', <svg key="m" width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M5.5 1L1 3v10l4.5-2 4 2 4.5-2V1L9.5 3l-4-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none"/><line x1="5.5" y1="1" x2="5.5" y2="11" stroke="currentColor" strokeWidth="1.4"/><line x1="9.5" y1="3" x2="9.5" y2="13" stroke="currentColor" strokeWidth="1.4"/></svg>],
              ].map(([v, icon]) => (
                <button key={v} className={`view-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{icon}</button>
              ))}
            </div>

            {/* Avatar */}
            {currentUser && (
              <div
                className="browse-avatar"
                onClick={onDashboard}
                title="My Dashboard"
                style={{ width: 36, height: 36, borderRadius: '50%', background: '#00274C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#FFCB05', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,39,76,0.25)', transition: 'box-shadow 0.15s, transform 0.2s ease', userSelect: 'none' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,39,76,0.2)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,39,76,0.25)'}>
                {(() => { const u = currentUser.email?.split('@')[0] || ''; return (u[0] + (u[u.length - 1] || '')).toUpperCase() })()}
              </div>
            )}
          </div>
        </nav>

        {/* FILTER BAR */}
        <div className="filter-bar-wrap" style={{ background: dm ? '#1c1c1e' : '#fff', borderBottom: `1px solid ${dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, flexShrink: 0, zIndex: 9999 }}>
        <div className="filter-bar" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', flexWrap: 'nowrap', scrollbarWidth: 'none' }}>

          <FilterPill label={dateFrom || dateTo ? `${dateFrom || '...'} → ${dateTo || '...'}` : '📅 Dates'} active={!!(dateFrom || dateTo)} onClear={() => { setDateFrom(''); setDateTo('') }} dm={dm}>
            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: dm ? '#636366' : '#aeaeb2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>From</div>
            <input type="date" className="date-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ marginBottom: 12 }} />
            <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 700, color: dm ? '#636366' : '#aeaeb2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>To</div>
            <input type="date" className="date-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </FilterPill>

          <FilterPill label={beds !== 'Any' ? `🛏 ${beds}` : '🛏 Bedrooms'} active={beds !== 'Any'} onClear={() => setBeds('Any')} dm={dm}>
            <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: dm ? '#636366' : '#aeaeb2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Bedrooms</div>
            {['Any', 'Studio', '1 Bed', '2 Bed', '3 Bed', '4+ Bed'].map(b => (
              <button key={b} className={`bed-opt ${beds === b ? 'active' : ''}`} onClick={() => setBeds(b)}>{b}</button>
            ))}
          </FilterPill>

          <FilterPill label={priceActive ? `💰 Under $${maxPrice.toLocaleString()}` : '💰 Price'} active={priceActive} onClear={() => { setPriceActive(false); setMaxPrice(3000) }} dm={dm}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: dm ? '#636366' : '#aeaeb2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Max rent</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: dm ? '#FFCB05' : '#00274C', letterSpacing: '-0.02em' }}>${maxPrice.toLocaleString()}</div>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: `linear-gradient(to right, ${dm ? '#FFCB05' : '#00274C'} ${(maxPrice / MAX_SLIDER) * 100}%, ${dm ? '#3a3a3e' : '#e5e7eb'} ${(maxPrice / MAX_SLIDER) * 100}%)`, borderRadius: 2, transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="range" min={500} max={MAX_SLIDER} step={50} value={maxPrice} onChange={e => { setMaxPrice(parseInt(e.target.value)); setPriceActive(true) }} className="price-slider" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aeaeb2', marginBottom: 12 }}>
              <span>$500</span><span>$3,000+</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1000, 1500, 2000, 2500].map(p => (
                <button key={p} onClick={() => { setMaxPrice(p); setPriceActive(true) }} style={{ padding: '5px 10px', borderRadius: 980, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${maxPrice === p && priceActive ? '#00274C' : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)')}`, background: maxPrice === p && priceActive ? '#00274C' : (dm ? '#2c2c2e' : '#fff'), color: maxPrice === p && priceActive ? '#FFCB05' : (dm ? '#8e8e93' : '#6e6e73'), transition: 'all 0.15s' }}>
                  Under ${p.toLocaleString()}
                </button>
              ))}
            </div>
          </FilterPill>

          <FilterPill label={selectedTags.length > 0 ? `✨ Amenities (${selectedTags.length})` : '✨ Amenities'} active={selectedTags.length > 0} onClear={() => setSelectedTags([])} dm={dm}>
            <div style={{ marginBottom: 10, fontSize: 11, fontWeight: 700, color: dm ? '#636366' : '#aeaeb2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Select amenities</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 280 }}>
              {TAGS.map(tag => (
                <button key={tag} className={`tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`} onClick={() => toggleTag(tag)}>
                  {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                </button>
              ))}
            </div>
          </FilterPill>

          <FilterPill label={neighborhood !== 'Any' ? `📍 ${neighborhood}` : '📍 Neighborhood'} active={neighborhood !== 'Any'} onClear={() => setNeighborhood('Any')} dm={dm}>
            <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 700, color: dm ? '#636366' : '#aeaeb2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Neighborhood</div>
            {['Any', ...NEIGHBORHOODS].map(n => (
              <button key={n} className={`bed-opt ${neighborhood === n ? 'active' : ''}`} onClick={() => setNeighborhood(n)}>{n}</button>
            ))}
          </FilterPill>

          <button
            onClick={() => setHideFilled(h => !h)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 980, flexShrink: 0,
              border: `1.5px solid ${hideFilled ? '#00274C' : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,39,76,0.15)')}`,
              background: hideFilled ? '#00274C' : (dm ? '#2c2c2e' : '#fff'),
              color: hideFilled ? '#FFCB05' : (dm ? '#f5f5f7' : '#1d1d1f'),
              fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
            }}>
            {hideFilled ? '✓ ' : ''}Hide Filled
          </button>

          {anyActive && (
            <>
              <div style={{ width: 1, height: 20, background: dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', flexShrink: 0 }} />
              <button onClick={clearAll} style={{ background: 'none', border: 'none', color: '#ff3b30', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, flexShrink: 0 }}>Clear all</button>
            </>
          )}

          <span style={{ fontSize: 12, color: dm ? '#636366' : '#aeaeb2', marginLeft: 'auto', flexShrink: 0 }}>
            {filtered.length} listing{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

          {/* LISTINGS */}
          {view !== 'map' && (
            <div className="listings-panel" style={{ width: view === 'split' ? '50%' : '100%', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: dm ? '#0f0f11' : '#f5f5f7' }}>
              {filterUserId && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.06)', border: `1px solid ${dm ? 'rgba(255,203,5,0.2)' : 'rgba(0,39,76,0.12)'}`, borderRadius: 12, padding: '10px 16px' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: dm ? '#FFCB05' : '#00274C' }}>👤 Showing your listings only</span>
                  <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 12, color: dm ? '#8e8e93' : '#6e6e73', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>View all listings →</button>
                </div>
              )}
              {loading ? (
                [1,2,3,4].map(n => (
                  <div key={n} style={{ background: dm ? '#1c1c1e' : '#fff', borderRadius: 16, overflow: 'hidden', border: `1.5px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}` }}>
                    <div className="skeleton" style={{ height: 180 }} />
                    <div style={{ padding: '14px 16px' }}>
                      <div className="skeleton" style={{ height: 14, width: '70%', borderRadius: 6, marginBottom: 8 }} />
                      <div className="skeleton" style={{ height: 12, width: '50%', borderRadius: 6, marginBottom: 10 }} />
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div className="skeleton" style={{ height: 22, width: 60, borderRadius: 980 }} />
                        <div className="skeleton" style={{ height: 22, width: 80, borderRadius: 980 }} />
                      </div>
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 24px' }}>
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,39,76,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 32 }}>🔍</div>
                  <p style={{ color: dm ? '#f5f5f7' : '#1d1d1f', fontSize: 17, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.01em' }}>No listings match your search</p>
                  <p style={{ color: dm ? '#636366' : '#aeaeb2', fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>{anyActive ? 'Try adjusting or clearing your filters to see more results.' : 'No subleases have been posted yet. Check back soon!'}</p>
                  {anyActive && <button onClick={clearAll} style={{ background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 980, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>Clear filters</button>}
                </div>
              ) : (() => {
                // Group by building_name — buildings with 2+ listings get a card header
                const buildingGroups = {}
                filtered.forEach(l => {
                  if (l.building_name) {
                    if (!buildingGroups[l.building_name]) buildingGroups[l.building_name] = []
                    buildingGroups[l.building_name].push(l)
                  }
                })
                const usedIds = new Set()
                const items = []
                filtered.forEach(listing => {
                  const bn = listing.building_name
                  if (bn && buildingGroups[bn].length > 1) {
                    if (!usedIds.has(`b:${bn}`)) {
                      items.push({ type: 'building', name: bn, listings: buildingGroups[bn] })
                      usedIds.add(`b:${bn}`)
                      buildingGroups[bn].forEach(l => usedIds.add(l.id))
                    }
                  } else if (!usedIds.has(listing.id)) {
                    items.push({ type: 'standalone', listing })
                    usedIds.add(listing.id)
                  }
                })

                const renderTile = (listing, compact = false) => (
                  <div key={listing.id} className={`listing-tile${hoveredListing?.id === listing.id ? ' map-hovered' : ''}`} onClick={() => setModalListing(listing)} style={{ opacity: listing.filled ? 0.75 : 1, marginBottom: compact ? 8 : 0 }}>
                    <div style={{ height: compact ? 120 : 180, background: dm ? '#2c2c2e' : '#f0f4ff', position: 'relative', overflow: 'hidden' }}>
                      {getCoverImage(listing.image_url)
                        ? <img src={getCoverImage(listing.image_url)} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🏠</div>
                      }
                      <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,39,76,0.88)', color: '#FFCB05', fontSize: 13, fontWeight: 800, padding: '3px 10px', borderRadius: 980 }}>${listing.price}/mo</div>
                      <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 6 }}>
                        {listing.filled
                          ? <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.55)', color: '#e5e5ea', padding: '3px 10px', borderRadius: 980 }}>Filled</span>
                          : <span className="pill pill-green">✓ Verified</span>
                        }
                      </div>
                    </div>
                    <div style={{ padding: '12px 14px' }}>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: dm ? '#f5f5f7' : '#1d1d1f', marginBottom: 3 }}>{listing.title}</h3>
                      <p style={{ fontSize: 12, color: dm ? '#636366' : '#aeaeb2', marginBottom: 8 }}>📍 {listing.address}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {listing.beds && <span className="pill">{listing.beds}</span>}
                        {listing.neighborhood && <span className="pill pill-blue">📍 {listing.neighborhood}</span>}
                        {listing.dates && <span className="pill pill-gold">{listing.dates}</span>}
                      </div>
                      {(() => {
                        const allTags = parseTags(listing.tags)
                        if (allTags.length === 0) return null
                        const shown = allTags.slice(0, 3)
                        const extra = allTags.length - shown.length
                        return (
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {shown.map(tag => (
                              <span key={tag} style={{ fontSize: 11, fontWeight: 500, background: dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.07)', color: dm ? '#FFCB05' : '#00274C', padding: '3px 9px', borderRadius: 980 }}>{tag}</span>
                            ))}
                            {extra > 0 && (
                              <span style={{ fontSize: 11, fontWeight: 500, background: dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)', color: dm ? '#8e8e93' : '#6e6e73', padding: '3px 9px', borderRadius: 980 }}>+{extra} more</span>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )

                return items.map(item => {
                  if (item.type === 'standalone') return renderTile(item.listing)

                  // Building group card
                  const available = item.listings.filter(l => !l.filled)
                  const prices = item.listings.map(l => l.price).filter(Boolean)
                  const minP = Math.min(...prices)
                  const maxP = Math.max(...prices)
                  const priceRange = prices.length === 0 ? '' : minP === maxP ? `$${minP.toLocaleString()}/mo` : `$${minP.toLocaleString()} – $${maxP.toLocaleString()}/mo`
                  const expanded = expandedBuildings.has(item.name)

                  return (
                    <div key={`building-${item.name}`} className="building-card">
                      <div className="building-header" onClick={() => toggleBuilding(item.name)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🏢</div>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 700, color: dm ? '#f5f5f7' : '#1d1d1f', marginBottom: 2 }}>{item.name}</div>
                            <div style={{ fontSize: 12, color: dm ? '#8e8e93' : '#6e6e73', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                              <span style={{ background: dm ? 'rgba(52,199,89,0.12)' : 'rgba(52,199,89,0.1)', color: dm ? '#34c759' : '#1a8c39', fontWeight: 600, padding: '2px 8px', borderRadius: 980, fontSize: 11 }}>
                                {available.length} unit{available.length !== 1 ? 's' : ''} available
                              </span>
                              {priceRange && <span style={{ color: dm ? '#FFCB05' : '#00274C', fontWeight: 600 }}>{priceRange}</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: dm ? '#8e8e93' : '#6e6e73', fontWeight: 500 }}>{expanded ? 'Collapse' : 'View units'}</span>
                          <span style={{ fontSize: 16, color: dm ? '#8e8e93' : '#aeaeb2', display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ borderTop: `1px solid ${dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'}`, padding: '10px 10px 2px' }}>
                          {item.listings.map(l => renderTile(l, true))}
                        </div>
                      )}
                    </div>
                  )
                })
              })()}
            </div>
          )}

          {/* MAP */}
          {view !== 'list' && (
            <div style={{ flex: 1, position: 'relative' }}>
              <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  key={dm ? 'dark' : 'light'}
                  url={dm
                    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'}
                  attribution='&copy; OpenStreetMap contributors &copy; CARTO'
                />
                {filtered.map(listing => {
                  const coords = geocoded[listing.id]
                  if (!coords) return null
                  const latLng = [coords.lat, coords.lng]
                  return (
                    <Marker
                      key={listing.id}
                      position={latLng}
                      icon={UMichIcon}
                      eventHandlers={{
                        click: () => setModalListing(listing),
                        mouseover: () => { setHoveredListing(listing); setHoveredLatLng(latLng) },
                        mouseout: () => { setHoveredListing(null); setHoveredLatLng(null) },
                      }}
                    />
                  )
                })}
                <MapTooltip listing={hoveredListing} latLng={hoveredLatLng} dm={dm} />
              </MapContainer>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalListing && <ListingModal listing={modalListing} onClose={() => setModalListing(null)} darkMode={dm} currentUser={currentUser} onSignIn={onSignIn} />}
    </>
  )
}
