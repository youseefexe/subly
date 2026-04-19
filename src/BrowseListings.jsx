import { useState, useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from './supabase'
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
  html: `<div style="background:#00274C;color:#FFCB05;width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid #FFCB05;"><span style="transform:rotate(45deg);font-size:14px;">🏠</span></div>`,
  iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -36],
})

const TAGS = ['Utilities included', 'In-unit washer/dryer', 'Parking included', 'Pet friendly', 'Furnished', 'A/C', 'Dishwasher', 'Gym access', 'Near bus line', 'Private bathroom', 'Short term ok', 'Bills split']

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
  const ref = useRef(null)

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
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
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', left: 0, zIndex: 9999,
          background: dm ? '#1c1c1e' : '#fff', borderRadius: 16,
          border: `1px solid ${dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          boxShadow: '0 16px 48px rgba(0,0,0,0.25)', padding: 20, minWidth: 240,
          animation: 'pop-in 0.15s ease',
        }}>
          {children}
          <button onClick={() => setOpen(false)} style={{ marginTop: 16, width: '100%', background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Apply
          </button>
        </div>
      )}
    </div>
  )
}

export default function BrowseListings({ onBack, onPost, currentUser, initialModal, onModalClear, darkMode, onToggleDark }) {
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
  const [hideFilled, setHideFilled] = useState(false)
  const MAX_SLIDER = 3000

  useEffect(() => { fetchListings() }, [])
  useEffect(() => { if (initialModal) { setModalListing(initialModal); if (onModalClear) onModalClear() } }, [initialModal])

  const fetchListings = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('listings').select('*')
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
    if (search) result = result.filter(l => l.title?.toLowerCase().includes(search.toLowerCase()) || l.address?.toLowerCase().includes(search.toLowerCase()))
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
        const lt = Array.isArray(l.tags) ? l.tags : (l.tags ? [l.tags] : [])
        return selectedTags.every(t => lt.includes(t))
      })
    }
    if (hideFilled) result = result.filter(l => !l.filled)
    setFiltered(result)
  }, [search, beds, maxPrice, priceActive, dateFrom, dateTo, selectedTags, hideFilled, listings])

  const clearAll = () => { setBeds('Any'); setMaxPrice(3000); setPriceActive(false); setDateFrom(''); setDateTo(''); setSelectedTags([]); setHideFilled(false) }
  const anyActive = beds !== 'Any' || priceActive || dateFrom || dateTo || selectedTags.length > 0 || hideFilled
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
        .view-btn { background: transparent; border: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 16px; transition: background 0.15s; }
        .view-btn:hover { background: rgba(0,0,0,0.06); }
        .view-btn.active { background: rgba(0,39,76,0.08); }
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
        .date-input { width: 100%; border: 1.5px solid rgba(0,39,76,0.12); border-radius: 10px; padding: 9px 12px; font-size: 13px; font-family: inherit; color: #1d1d1f; outline: none; transition: border-color 0.2s; background: #fff; }
        .date-input:focus { border-color: #00274C; }
        .leaflet-container { height: 100%; width: 100%; }
        .leaflet-popup-content-wrapper { border-radius: 12px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important; }
        .leaflet-popup-tip { display: none; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 4px; }
        .dark-toggle { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; border: 1.5px solid; }
        .dark-toggle:hover { transform: scale(1.1); }
        [data-theme="dark"] body { background: #0f0f11; }
        [data-theme="dark"] .listing-tile { background: #1c1c1e; border-color: rgba(255,255,255,0.08); }
        [data-theme="dark"] .listing-tile:hover { box-shadow: 0 12px 36px rgba(0,0,0,0.4); border-color: rgba(255,255,255,0.14); }
        [data-theme="dark"] .view-btn:hover { background: rgba(255,255,255,0.08); }
        [data-theme="dark"] .view-btn.active { background: rgba(255,255,255,0.12); }
        [data-theme="dark"] .search-input { color: #f5f5f7; }
        [data-theme="dark"] .search-input::placeholder { color: #636366; }
        [data-theme="dark"] .pill { background: #2c2c2e; color: #8e8e93; }
        [data-theme="dark"] .pill-gold { color: #FFCB05; }
        [data-theme="dark"] .pill-blue { background: rgba(255,203,5,0.1); color: #FFCB05; }
        [data-theme="dark"] .bed-opt { border-color: rgba(255,255,255,0.1); color: #f5f5f7; }
        [data-theme="dark"] .bed-opt:hover { background: rgba(255,255,255,0.05); }
        [data-theme="dark"] .tag-chip { background: #2c2c2e; color: #8e8e93; border-color: rgba(255,255,255,0.1); }
        [data-theme="dark"] .date-input { background: #2c2c2e; color: #f5f5f7; border-color: rgba(255,255,255,0.1); }
      `}</style>

      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif', background: dm ? '#0f0f11' : '#f5f5f7' }}>

        {/* NAV */}
        <nav style={{ background: dm ? '#1c1c1e' : '#fff', borderBottom: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, zIndex: 50 }}>
          <SublyWordmark size={26} onClick={onBack} light={dm} />
          <div style={{ flex: 1, maxWidth: 480, margin: '0 24px', background: dm ? '#2c2c2e' : '#f5f5f7', border: `1.5px solid ${dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`, borderRadius: 980, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: dm ? '#636366' : '#aeaeb2' }}>🔍</span>
            <input className="search-input" placeholder="Search by title or address..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: dm ? '#636366' : '#aeaeb2', cursor: 'pointer', fontSize: 16 }}>×</button>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', background: dm ? '#2c2c2e' : '#f5f5f7', borderRadius: 10, padding: 3, gap: 2 }}>
              {[['split', '⊞'], ['list', '☰'], ['map', '🗺']].map(([v, icon]) => (
                <button key={v} className={`view-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>{icon}</button>
              ))}
            </div>
            <button className="dark-toggle" onClick={onToggleDark} title={dm ? 'Light mode' : 'Dark mode'} style={{ borderColor: dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', background: dm ? 'rgba(255,255,255,0.08)' : '#f5f5f7' }}>
              {dm ? '☀️' : '🌙'}
            </button>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: dm ? '#8e8e93' : '#6e6e73', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>← Home</button>
            {currentUser && (
              <button onClick={onPost} style={{ background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 980, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>+ Post</button>
            )}
          </div>
        </nav>

        {/* FILTER BAR */}
        <div style={{ background: dm ? '#1c1c1e' : '#fff', borderBottom: `1px solid ${dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, overflowX: 'visible', zIndex: 999, position: 'relative' }}>

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
              <div style={{ fontSize: 11, fontWeight: 700, color: '#aeaeb2', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Max rent</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#00274C', letterSpacing: '-0.02em' }}>${maxPrice.toLocaleString()}</div>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 4, background: `linear-gradient(to right, #00274C ${(maxPrice / MAX_SLIDER) * 100}%, #e5e7eb ${(maxPrice / MAX_SLIDER) * 100}%)`, borderRadius: 2, transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <input type="range" min={500} max={MAX_SLIDER} step={50} value={maxPrice} onChange={e => { setMaxPrice(parseInt(e.target.value)); setPriceActive(true) }} className="price-slider" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#aeaeb2', marginBottom: 12 }}>
              <span>$500</span><span>$3,000+</span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[1000, 1500, 2000, 2500].map(p => (
                <button key={p} onClick={() => { setMaxPrice(p); setPriceActive(true) }} style={{ padding: '5px 10px', borderRadius: 980, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: `1.5px solid ${maxPrice === p && priceActive ? '#00274C' : 'rgba(0,0,0,0.1)'}`, background: maxPrice === p && priceActive ? '#00274C' : '#fff', color: maxPrice === p && priceActive ? '#FFCB05' : '#6e6e73', transition: 'all 0.15s' }}>
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

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

          {/* LISTINGS */}
          {view !== 'map' && (
            <div style={{ width: view === 'split' ? '50%' : '100%', overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: dm ? '#0f0f11' : '#f5f5f7' }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <p style={{ color: '#aeaeb2', fontSize: 14 }}>Loading listings...</p>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
                  <p style={{ color: dm ? '#f5f5f7' : '#1d1d1f', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No listings found</p>
                  <p style={{ color: dm ? '#636366' : '#aeaeb2', fontSize: 14, marginBottom: 16 }}>Try adjusting your filters.</p>
                  {anyActive && <button onClick={clearAll} style={{ background: 'none', border: '1.5px solid rgba(0,39,76,0.2)', borderRadius: 980, padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', color: '#00274C' }}>Clear filters</button>}
                </div>
              ) : (
                filtered.map(listing => (
                  <div key={listing.id} className="listing-tile" onClick={() => setModalListing(listing)} style={{ opacity: listing.filled ? 0.75 : 1 }}>
                    <div style={{ height: 180, background: '#f0f4ff', position: 'relative', overflow: 'hidden' }}>
                      {getCoverImage(listing.image_url)
                        ? <img src={getCoverImage(listing.image_url)} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 }}>🏠</div>
                      }
                      <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,39,76,0.88)', color: '#FFCB05', fontSize: 14, fontWeight: 800, padding: '4px 12px', borderRadius: 980 }}>${listing.price}/mo</div>
                      <div style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', gap: 6 }}>
                        {listing.filled
                          ? <span style={{ fontSize: 11, fontWeight: 600, background: 'rgba(0,0,0,0.55)', color: '#e5e5ea', padding: '3px 10px', borderRadius: 980 }}>Filled</span>
                          : <span className="pill pill-green">✓ Verified</span>
                        }
                      </div>
                    </div>
                    <div style={{ padding: '14px 16px' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: dm ? '#f5f5f7' : '#1d1d1f', marginBottom: 4 }}>{listing.title}</h3>
                      <p style={{ fontSize: 13, color: dm ? '#636366' : '#aeaeb2', marginBottom: 10 }}>📍 {listing.address}</p>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {listing.beds && <span className="pill">{listing.beds}</span>}
                        {listing.dates && <span className="pill pill-gold">{listing.dates}</span>}
                        {Array.isArray(listing.tags) && listing.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="pill pill-blue">{tag}</span>
                        ))}
                        {Array.isArray(listing.tags) && listing.tags.length > 2 && (
                          <span className="pill">+{listing.tags.length - 2} more</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* MAP */}
          {view !== 'list' && (
            <div style={{ flex: 1, position: 'relative' }}>
              <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap contributors' />
                {filtered.map(listing => {
                  const coords = geocoded[listing.id]
                  if (!coords) return null
                  return (
                    <Marker key={listing.id} position={[coords.lat, coords.lng]} icon={UMichIcon} eventHandlers={{ click: () => setModalListing(listing) }}>
                      <Popup>
                        <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 200 }}>
                          {listing.image_url && <img src={listing.image_url} alt={listing.title} style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#00274C', marginBottom: 2 }}>{listing.title}</div>
                          <div style={{ fontSize: 12, color: '#6e6e73', marginBottom: 6 }}>{listing.address}</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#00274C' }}>${listing.price}/mo</div>
                          {listing.beds && <div style={{ fontSize: 11, color: '#6e6e73', marginTop: 4 }}>{listing.beds} · {listing.dates}</div>}
                          <button onClick={() => setModalListing(listing)} style={{ marginTop: 8, width: '100%', background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 8, padding: '7px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>View details</button>
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>
          )}
        </div>
      </div>

      {/* MODAL */}
      {modalListing && <ListingModal listing={modalListing} onClose={() => setModalListing(null)} darkMode={dm} />}
    </>
  )
}
