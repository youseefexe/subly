import { useState, useEffect, useRef } from 'react'
import { parseTags } from './utils'
import { SublyLogo, SublyWordmark } from './Logo'
import { supabase } from './supabase'

const MAX_IMAGES = 5
const TAGS = ['Utilities included', 'In-unit washer/dryer', 'Parking included', 'Pet friendly', 'Furnished', 'A/C', 'Dishwasher', 'Gym access', 'Near bus line', 'Private bathroom', 'Short term ok', 'Bills split', 'Negotiable']
const NEIGHBORHOODS = ['Central Campus', 'North Campus', 'South Campus', 'Kerrytown', 'Burns Park', 'Old West Side', 'Downtown Ann Arbor', 'Near Northside', 'Water Hill', 'Other']

const KNOWN_COMPLEXES = [
  { name: 'Oxford Housing', address: '800 Oxford Rd, Ann Arbor, MI 48104' },
  { name: 'The Yard', address: '623 S Main St, Ann Arbor, MI 48104' },
  { name: 'Z Place', address: '1220 S University Ave, Ann Arbor, MI 48104' },
  { name: 'University Towers', address: '535 W William St, Ann Arbor, MI 48104' },
  { name: 'The Standard', address: '210 S 4th Ave, Ann Arbor, MI 48104' },
  { name: 'VERVE', address: '425 S Main St, Ann Arbor, MI 48104' },
  { name: 'Haven Hall', address: '1155 Beal Ave, Ann Arbor, MI 48109' },
  { name: 'Zaragon Place', address: '619 E University Ave, Ann Arbor, MI 48104' },
  { name: '411 Lofts', address: '411 W Washington St, Ann Arbor, MI 48104' },
  { name: 'Michigan House', address: '611 Church St, Ann Arbor, MI 48104' },
]

// ─── Date helpers ───────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const WDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

function sod(date) { // start of day
  if (!date) return null
  const d = new Date(date); d.setHours(0,0,0,0); return d
}
function same(a, b) {
  if (!a || !b) return false
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}
function before(a, b) { return a && b && a.getTime() < b.getTime() }
function buildCells(year, month) {
  const first = new Date(year, month, 1).getDay()
  const total = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < first; i++) cells.push(null)
  for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d))
  return cells
}
function fmtDate(d) {
  if (!d) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── RangeDatePicker component ───────────────────────────────────
function RangeDatePicker({ startDate, endDate, onStart, onEnd, dm }) {
  const today = sod(new Date())
  const [vy, setVy] = useState(today.getFullYear())
  const [vm, setVm] = useState(today.getMonth())
  const [picking, setPicking] = useState('start')
  const [hover, setHover] = useState(null)

  const ry = vm === 11 ? vy + 1 : vy
  const rm = vm === 11 ? 0 : vm + 1

  const prev = () => { if (vm === 0) { setVm(11); setVy(y => y-1) } else setVm(m => m-1) }
  const next = () => { if (vm === 11) { setVm(0); setVy(y => y+1) } else setVm(m => m+1) }

  const handleClick = (date) => {
    const d = sod(date)
    if (before(d, today) && !same(d, today)) return
    if (picking === 'start' || !startDate || before(d, startDate)) {
      onStart(d); onEnd(null); setPicking('end')
    } else {
      onEnd(d); setPicking('start')
    }
  }

  // effective end for hover preview
  const effEnd = endDate || (picking === 'end' && hover && startDate && !before(hover, startDate) ? hover : null)

  const isStart = (d) => same(d, startDate)
  const isEnd = (d) => {
    if (same(d, endDate)) return true
    if (!endDate && picking === 'end' && hover && startDate && !before(hover, startDate)) return same(d, hover)
    return false
  }
  const inRange = (d) => {
    if (!d || !startDate || !effEnd) return false
    const t = d.getTime(), s = startDate.getTime(), e = effEnd.getTime()
    return t > Math.min(s,e) && t < Math.max(s,e)
  }

  const bgCard = dm ? '#1c1c1e' : '#fff'
  const borderColor = dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,39,76,0.12)'
  const divider = dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  const tp = dm ? '#f5f5f7' : '#1d1d1f'
  const ts = dm ? '#8e8e93' : '#6e6e73'
  const tf = dm ? '#636366' : '#aeaeb2'
  const rangeBg = dm ? 'rgba(255,203,5,0.12)' : 'rgba(0,39,76,0.07)'

  const renderMonth = (year, month, showL, showR) => {
    const cells = buildCells(year, month)
    // pad to complete last row
    while (cells.length % 7 !== 0) cells.push(null)

    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <button onClick={prev} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'none', cursor: showL ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: showL ? ts : 'transparent', transition: 'background 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (showL) e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            ‹
          </button>
          <span style={{ fontSize: 14, fontWeight: 700, color: tp, letterSpacing: '-0.01em' }}>{MONTHS[month]} {year}</span>
          <button onClick={next} style={{ width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'none', cursor: showR ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: showR ? ts : 'transparent', transition: 'background 0.15s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (showR) e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
            ›
          </button>
        </div>

        {/* Weekday labels */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
          {WDAYS.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: tf, padding: '4px 0', letterSpacing: '0.04em' }}>{d}</div>
          ))}
        </div>

        {/* Day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((date, idx) => {
            if (!date) return <div key={`e-${month}-${idx}`} style={{ height: 38 }} />

            const isPast = before(date, today) && !same(date, today)
            const start = isStart(date)
            const end = isEnd(date)
            const range = inRange(date)
            const isToday = same(date, today)

            // Half-band: right side of start cell, left side of end cell
            const bandRight = start && effEnd && !same(date, effEnd)
            const bandLeft = end && startDate && !same(date, startDate)

            let circleBg = 'transparent'
            let textCol = isPast ? (dm ? '#3a3a3c' : '#d2d2d7') : tp
            if (start) { circleBg = '#00274C'; textCol = '#FFCB05' }
            if (end) { circleBg = '#FFCB05'; textCol = '#00274C' }

            return (
              <div key={`${year}-${month}-${date.getDate()}`}
                style={{ position: 'relative', height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isPast ? 'default' : 'pointer' }}
                onMouseEnter={() => !isPast && setHover(sod(date))}
                onMouseLeave={() => setHover(null)}
                onClick={() => handleClick(date)}>

                {/* Range band */}
                {(range || bandRight || bandLeft) && (
                  <div style={{
                    position: 'absolute', top: '50%', transform: 'translateY(-50%)', height: 34,
                    left: bandLeft ? 0 : (range ? 0 : '50%'),
                    right: bandRight ? 0 : (range ? 0 : '50%'),
                    background: rangeBg, pointerEvents: 'none',
                  }} />
                )}

                {/* Circle */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%', background: circleBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative', zIndex: 1, transition: 'background 0.1s',
                  ...((!start && !end && !isPast) && { ':hover': { background: dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' } }),
                }}>
                  <span style={{ fontSize: 13, fontWeight: start || end ? 700 : (isToday ? 600 : 400), color: textCol, lineHeight: 1 }}>
                    {date.getDate()}
                  </span>
                  {isToday && !start && !end && (
                    <div style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: dm ? '#FFCB05' : '#00274C' }} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const tabActive = (key) => picking === key
  const days = startDate && endDate ? Math.round((endDate - startDate) / 86400000) : null

  return (
    <div style={{ background: bgCard, border: `1.5px solid ${borderColor}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

      {/* FROM / TO tabs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: `1.5px solid ${divider}` }}>
        {[
          { key: 'start', label: 'FROM', value: startDate ? fmtDate(startDate) : null },
          { key: 'end', label: 'TO', value: endDate ? fmtDate(endDate) : null },
        ].map((tab, i) => (
          <button key={tab.key} onClick={() => setPicking(tab.key)} style={{
            padding: '14px 20px', background: tabActive(tab.key) ? (dm ? 'rgba(255,203,5,0.05)' : 'rgba(0,39,76,0.025)') : 'transparent',
            border: 'none', borderRight: i === 0 ? `1px solid ${divider}` : 'none',
            borderBottom: `2.5px solid ${tabActive(tab.key) ? (dm ? '#FFCB05' : '#00274C') : 'transparent'}`,
            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 4, color: tabActive(tab.key) ? (dm ? '#FFCB05' : '#00274C') : tf }}>
              {tab.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: tab.value ? tp : tf }}>
              {tab.value || 'Add date'}
            </div>
          </button>
        ))}
      </div>

      {/* Calendars */}
      <div className="cal-grid" style={{ display: 'flex', gap: 0, padding: '20px 24px' }}>
        {renderMonth(vy, vm, true, false)}
        <div className="cal-divider" style={{ width: 1, background: divider, margin: '0 20px', flexShrink: 0 }} />
        {renderMonth(ry, rm, false, true)}
      </div>

      {/* Footer */}
      <div style={{ padding: '10px 24px 16px', borderTop: `1px solid ${divider}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 44 }}>
        <span style={{ fontSize: 13, color: ts }}>
          {days !== null
            ? <><span style={{ fontWeight: 700, color: dm ? '#FFCB05' : '#00274C' }}>{days}</span> days</>
            : startDate ? <span style={{ color: tf }}>Now select your end date</span>
            : <span style={{ color: tf }}>Select your move-in date</span>}
        </span>
        {(startDate || endDate) && (
          <button onClick={() => { onStart(null); onEnd(null); setPicking('start') }} style={{ background: 'none', border: 'none', fontSize: 13, color: tf, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500, transition: 'color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.color = dm ? '#f5f5f7' : '#1d1d1f'}
            onMouseLeave={e => e.currentTarget.style.color = tf}>
            Clear dates
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────
export default function PostListing({ onBack, user, onSuccess, darkMode, onToggleDark }) {
  const dm = darkMode
  const [form, setForm] = useState({
    title: '', address: '', building_name: '', price: '', beds: 'Studio',
    neighborhood: '', description: '', contact_email: user?.email || ''
  })
  const [startDate, setStartDate] = useState(null)
  const [endDate, setEndDate] = useState(null)
  const [images, setImages] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const [selectedTags, setSelectedTags] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [complexMatches, setComplexMatches] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const addressRef = useRef(null)
  const suggestionsRef = useRef(null)
  const debounceRef = useRef(null)

  const update = (field, val) => setForm(f => ({ ...f, [field]: val }))
  const toggleTag = tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          addressRef.current && !addressRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getComplexMatches = (val) => {
    if (!val) return KNOWN_COMPLEXES
    const lv = val.toLowerCase()
    return KNOWN_COMPLEXES.filter(c => c.name.toLowerCase().includes(lv) || c.address.toLowerCase().includes(lv))
  }

  const handleAddressInput = (val) => {
    update('address', val)
    const matched = getComplexMatches(val)
    setComplexMatches(matched)
    setSuggestions([])
    if (matched.length > 0) setShowSuggestions(true)
    if (!val || val.length < 3) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val + ' Ann Arbor MI')}&format=json&addressdetails=1&limit=5&countrycodes=us`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const data = await res.json()
        if (data.length > 0) { setSuggestions(data); setShowSuggestions(true) }
      } catch (e) { setSuggestions([]) }
    }, 350)
  }

  const selectSuggestion = (suggestion) => {
    update('address', suggestion.display_name.split(',').slice(0, 3).join(','))
    setSuggestions([]); setComplexMatches([]); setShowSuggestions(false)
  }

  const selectComplex = (complex) => {
    update('address', complex.address)
    update('building_name', complex.name)
    setSuggestions([]); setComplexMatches([]); setShowSuggestions(false)
  }

  const handleImages = (files) => {
    setError('')
    const incoming = Array.from(files)
    const combined = [...images]
    for (const file of incoming) {
      if (combined.length >= MAX_IMAGES) { setError(`Maximum ${MAX_IMAGES} photos allowed.`); break }
      if (!file.type.startsWith('image/')) { setError('Only image files are allowed.'); continue }
      if (file.size > 5 * 1024 * 1024) { setError('Each image must be under 5MB.'); continue }
      combined.push({ file, preview: URL.createObjectURL(file) })
    }
    setImages(combined)
  }

  const removeImage = (index) => setImages(prev => prev.filter((_, i) => i !== index))

  const formatDates = () => {
    if (!startDate || !endDate) return ''
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return `${fmt(startDate)} to ${fmt(endDate)}`
  }

  const handleSubmit = async () => {
    setError('')
    if (!form.title || !form.address || !form.price || !startDate || !endDate) {
      setError('Please fill in all required fields.'); return
    }
    setStatus('loading')

    const imageUrls = []
    for (const img of images) {
      const ext = img.file.name.split('.').pop()
      const filename = `${user?.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('listing-images').upload(filename, img.file)
      if (uploadError) { setError('Image upload failed. Please try again.'); setStatus('idle'); return }
      const { data } = supabase.storage.from('listing-images').getPublicUrl(filename)
      imageUrls.push(data.publicUrl)
    }

    const { error: insertError } = await supabase.from('listings').insert([{
      title: form.title, address: form.address, price: parseInt(form.price),
      beds: form.beds, dates: formatDates(), description: form.description,
      contact_email: form.contact_email, user_id: user?.id,
      image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      tags: selectedTags.length > 0 ? JSON.stringify(selectedTags) : null,
      neighborhood: form.neighborhood || null,
      building_name: form.building_name || null,
    }])

    if (insertError) { setError(insertError.message); setStatus('idle') }
    else {
      const newListing = {
        title: form.title, address: form.address, price: parseInt(form.price),
        beds: form.beds, dates: formatDates(), description: form.description,
        contact_email: form.contact_email, image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        tags: selectedTags, building_name: form.building_name || null,
      }
      if (onSuccess) onSuccess(newListing)
      else setStatus('success')
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
        [data-theme="dark"] body { background: #0f0f11; }

        .field-input { width: 100%; background: #f7f7f8; border: 1.5px solid transparent; border-radius: 12px; padding: 13px 16px; font-size: 15px; font-family: inherit; color: #1d1d1f; transition: all 0.2s; outline: none; }
        .field-input:focus { background: #fff; border-color: #00274C; box-shadow: 0 0 0 3px rgba(0,39,76,0.08); }
        .field-input::placeholder { color: #aeaeb2; }
        [data-theme="dark"] .field-input { background: #2c2c2e; border-color: rgba(255,255,255,0.1); color: #f5f5f7; }
        [data-theme="dark"] .field-input::placeholder { color: #636366; }
        [data-theme="dark"] .field-input:focus { background: #3a3a3c; border-color: #FFCB05; box-shadow: 0 0 0 3px rgba(255,203,5,0.1); }

        .submit-btn { width: 100%; background: #00274C; color: #FFCB05; border-radius: 980px; padding: 14px; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; border: none; transition: all 0.2s; letter-spacing: -0.01em; }
        .submit-btn:hover { background: #003a6e; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,39,76,0.25); }
        .submit-btn:active { transform: scale(0.98); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

        .drop-zone { border: 2px dashed rgba(0,39,76,0.2); border-radius: 16px; padding: 36px 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: #f7f7f8; }
        .drop-zone:hover { border-color: #00274C; background: rgba(0,39,76,0.03); }
        .drop-zone.drag-over { border-color: #00274C; background: rgba(0,39,76,0.05); transform: scale(1.01); }
        [data-theme="dark"] .drop-zone { background: #2c2c2e; border-color: rgba(255,255,255,0.15); }
        [data-theme="dark"] .drop-zone:hover { border-color: #FFCB05; background: rgba(255,203,5,0.05); }

        .dark-toggle { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; border: 1.5px solid; }
        .dark-toggle:hover { transform: scale(1.1); }

        .img-thumb { position: relative; border-radius: 12px; overflow: hidden; aspect-ratio: 1; }
        .img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .img-thumb .remove-btn { position: absolute; top: 6px; right: 6px; width: 26px; height: 26px; border-radius: 50%; background: rgba(0,0,0,0.65); color: #fff; border: none; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; font-family: inherit; }
        .img-thumb:hover .remove-btn { opacity: 1; }
        .img-thumb .badge { position: absolute; bottom: 6px; left: 6px; background: rgba(0,0,0,0.5); color: #fff; font-size: 10px; padding: 2px 8px; border-radius: 980px; font-weight: 600; }

        .suggestion-item { padding: 11px 16px; font-size: 14px; color: #1d1d1f; cursor: pointer; border-bottom: 1px solid rgba(0,0,0,0.05); transition: background 0.15s; display: flex; align-items: center; gap: 8px; }
        .suggestion-item:hover { background: rgba(0,39,76,0.04); }
        .suggestion-item:last-child { border-bottom: none; }
        [data-theme="dark"] .suggestion-item { color: #f5f5f7; border-bottom-color: rgba(255,255,255,0.06); }
        [data-theme="dark"] .suggestion-item:hover { background: rgba(255,203,5,0.06); }

        /* Calendar responsive */
        @media (max-width: 560px) {
          .cal-grid { flex-direction: column !important; padding: 16px !important; }
          .cal-divider { width: 100% !important; height: 1px !important; margin: 16px 0 !important; }
        }
        @media (max-width: 390px) {
          .two-col-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: dm ? '#0f0f11' : '#f5f5f7', fontFamily: 'Inter, sans-serif' }}>
        <nav style={{ background: dm ? '#1c1c1e' : '#fff', borderBottom: `1px solid ${dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, padding: '0 clamp(16px, 3vw, 48px)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SublyWordmark size={28} onClick={onBack} light={dm} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onToggleDark} title={dm ? 'Light mode' : 'Dark mode'} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.4, transition: 'opacity 0.15s', padding: '4px', lineHeight: 1 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}>
              {dm ? '☀️' : '🌙'}
            </button>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: dm ? '#8e8e93' : '#6e6e73', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
          </div>
        </nav>

        <div style={{ maxWidth: 640, margin: '0 auto', padding: '60px 24px', color: dm ? '#f5f5f7' : '#1d1d1f' }}>
          {status === 'success' ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#00274C', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <span style={{ color: '#FFCB05', fontSize: 28 }}>✓</span>
              </div>
              <h2 style={{ fontSize: 28, fontWeight: 800, color: dm ? '#f5f5f7' : '#00274C', marginBottom: 12, letterSpacing: '-0.02em' }}>Listing posted!</h2>
              <p style={{ fontSize: 16, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 36 }}>Your sublease is now live for UMich students to find.</p>
              <button onClick={onBack} style={{ background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 980, padding: '12px 28px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Back to home</button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: 36, fontWeight: 800, color: dm ? '#f5f5f7' : '#00274C', letterSpacing: '-0.03em', marginBottom: 8 }}>Post your sublease</h1>
                <p style={{ fontSize: 16, color: dm ? '#8e8e93' : '#6e6e73', fontWeight: 300 }}>Fill in the details and your listing goes live instantly.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* Images */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Photos</label>
                    <span style={{ fontSize: 12, color: images.length >= MAX_IMAGES ? '#ff3b30' : '#aeaeb2' }}>{images.length} / {MAX_IMAGES}</span>
                  </div>
                  {images.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
                      {images.map((img, i) => (
                        <div key={i} className="img-thumb">
                          <img src={img.preview} alt={`Photo ${i + 1}`} />
                          {i === 0 && <div className="badge">Cover</div>}
                          <button className="remove-btn" onClick={() => removeImage(i)}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {images.length < MAX_IMAGES && (
                    <div
                      className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
                      onClick={() => document.getElementById('image-input').click()}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDragOver(false); handleImages(e.dataTransfer.files) }}>
                      <div style={{ fontSize: 32, marginBottom: 10 }}>📷</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: dm ? '#FFCB05' : '#00274C', marginBottom: 4 }}>{images.length === 0 ? 'Add photos' : 'Add more photos'}</div>
                      <div style={{ fontSize: 13, color: '#aeaeb2' }}>Drag and drop or click to browse</div>
                      <div style={{ fontSize: 11, color: '#d2d2d7', marginTop: 4 }}>Up to {MAX_IMAGES} photos, 5MB each</div>
                    </div>
                  )}
                  <input id="image-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleImages(e.target.files)} />
                </div>

                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Listing Title *</label>
                  <input className="field-input" placeholder="e.g. Studio near Central Campus" value={form.title} onChange={e => update('title', e.target.value)} />
                </div>

                {/* Building / Complex Name */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Building / Complex Name</label>
                  <input className="field-input" placeholder="e.g. Oxford Housing, The Yard, Z Place, University Towers — leave blank if not applicable" value={form.building_name} onChange={e => update('building_name', e.target.value)} />
                </div>

                {/* Address */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Address *</label>
                  <input
                    ref={addressRef}
                    className="field-input"
                    placeholder="e.g. 523 E William St, Ann Arbor"
                    value={form.address}
                    onChange={e => handleAddressInput(e.target.value)}
                    onFocus={() => {
                      const matched = getComplexMatches(form.address)
                      setComplexMatches(matched)
                      if (matched.length > 0 || suggestions.length > 0) setShowSuggestions(true)
                    }}
                    autoComplete="off"
                  />
                  {showSuggestions && (complexMatches.length > 0 || suggestions.length > 0) && (
                    <div ref={suggestionsRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: dm ? '#2c2c2e' : '#fff', border: `1.5px solid ${dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,39,76,0.12)'}`, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 100, marginTop: 6, overflow: 'hidden' }}>
                      {complexMatches.length > 0 && (
                        <>
                          <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: dm ? '#636366' : '#aeaeb2' }}>Known Complexes</div>
                          {complexMatches.map((c, i) => (
                            <div key={i} className="suggestion-item" onMouseDown={() => selectComplex(c)}>
                              <span style={{ fontSize: 16, flexShrink: 0 }}>🏢</span>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 14, color: dm ? '#f5f5f7' : '#1d1d1f' }}>{c.name}</div>
                                <div style={{ fontSize: 12, color: dm ? '#8e8e93' : '#aeaeb2', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address}</div>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                      {suggestions.length > 0 && (
                        <>
                          {complexMatches.length > 0 && <div style={{ height: 1, background: dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '4px 0' }} />}
                          <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: dm ? '#636366' : '#aeaeb2' }}>Search Results</div>
                          {suggestions.map((s, i) => (
                            <div key={i} className="suggestion-item" onMouseDown={() => selectSuggestion(s)}>
                              <span style={{ fontSize: 14, color: '#6e6e73', flexShrink: 0 }}>📍</span>
                              <span style={{ fontWeight: 500, fontSize: 14 }}>{s.display_name.split(',').slice(0, 3).join(',')}</span>
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Neighborhood */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Neighborhood</label>
                  <select className="field-input" value={form.neighborhood} onChange={e => update('neighborhood', e.target.value)}>
                    <option value="">Select a neighborhood…</option>
                    {NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                {/* Price and Beds */}
                <div className="two-col-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Monthly Rent *</label>
                    <input className="field-input" type="number" placeholder="875" value={form.price} onChange={e => update('price', e.target.value)} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Bedrooms *</label>
                    <select className="field-input" value={form.beds} onChange={e => update('beds', e.target.value)}>
                      {['Studio', '1 Bed', '2 Bed', '3 Bed', '4+ Bed'].map(b => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                </div>

                {/* Date range — custom calendar */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Available Dates *</label>
                  <RangeDatePicker
                    startDate={startDate}
                    endDate={endDate}
                    onStart={setStartDate}
                    onEnd={setEndDate}
                    dm={dm}
                  />
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Description</label>
                  <textarea className="field-input" rows={4} placeholder="Describe your place, amenities, distance to campus, parking, etc." value={form.description} onChange={e => update('description', e.target.value)} style={{ resize: 'vertical' }} />
                </div>

                {/* Tags */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Amenities & Tags</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {TAGS.map(tag => (
                      <button key={tag} type="button" onClick={() => toggleTag(tag)} style={{
                        padding: '7px 14px', borderRadius: 980, fontSize: 13, fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit',
                        border: '1.5px solid',
                        borderColor: selectedTags.includes(tag) ? '#00274C' : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'),
                        background: selectedTags.includes(tag) ? '#00274C' : (dm ? '#2c2c2e' : '#fff'),
                        color: selectedTags.includes(tag) ? '#FFCB05' : (dm ? '#8e8e93' : '#6e6e73'),
                      }}>
                        {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Contact Email</label>
                  <input className="field-input" type="email" value={form.contact_email} onChange={e => update('contact_email', e.target.value)} />
                  <p style={{ fontSize: 12, color: '#aeaeb2', marginTop: 6 }}>This is how interested students will reach you.</p>
                </div>

                {error && (
                  <div style={{ background: dm ? 'rgba(220,38,38,0.12)' : '#FEF2F2', border: `1px solid ${dm ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.2)'}`, color: dm ? '#ff6b6b' : '#DC2626', fontSize: 13, padding: '12px 16px', borderRadius: 10 }}>{error}</div>
                )}

                <button className="submit-btn" onClick={handleSubmit} disabled={status === 'loading'}>
                  {status === 'loading' ? `Uploading${images.length > 0 ? ` ${images.length} photo${images.length > 1 ? 's' : ''}` : ''}...` : 'Post Listing'}
                </button>

                <p style={{ fontSize: 12, color: '#aeaeb2', textAlign: 'center' }}>Your listing will be visible to all verified UMich students immediately.</p>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
