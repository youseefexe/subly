import { useState, useEffect, useRef } from 'react'
import { parseTags } from './utils'
import { SublyLogo, SublyWordmark } from './Logo'
import { supabase } from './supabase'
import { RangeDatePicker, sod, fmtDate } from './DateRangePicker'

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

// ─── Main component ─────────────────────────────────────────────
export default function PostListing({ onBack, user, onSuccess, darkMode, onToggleDark }) {
  const dm = darkMode
  const [form, setForm] = useState({
    title: '', address: '', unit_number: '', building_name: '', price: '', beds: 'Studio',
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

    console.log('Inserting listing with user_id:', user?.id)
    const { error: insertError } = await supabase.from('listings').insert([{
      title: form.title, address: form.address, price: parseInt(form.price),
      beds: form.beds, dates: formatDates(), description: form.description,
      contact_email: form.contact_email, user_id: user?.id,
      image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      tags: selectedTags.length > 0 ? JSON.stringify(selectedTags) : null,
      neighborhood: form.neighborhood || null,
      building_name: form.building_name || null,
      unit_number: form.unit_number || null,
    }])

    if (insertError) { setError(insertError.message); setStatus('idle') }
    else {
      const newListing = {
        title: form.title, address: form.address, price: parseInt(form.price),
        beds: form.beds, dates: formatDates(), description: form.description,
        contact_email: form.contact_email, image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
        tags: selectedTags, building_name: form.building_name || null, unit_number: form.unit_number || null,
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

                {/* Address + Unit # */}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 8, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Address *</label>
                  <div style={{ display: 'flex', gap: 10, position: 'relative' }}>
                  <div style={{ flex: '0 0 75%', position: 'relative' }}>
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
                  <div style={{ flex: '0 0 calc(25% - 5px)' }}>
                    <input
                      className="field-input"
                      placeholder="Apt 4B"
                      value={form.unit_number}
                      onChange={e => update('unit_number', e.target.value)}
                      autoComplete="off"
                      style={{ height: '100%' }}
                    />
                    <div style={{ fontSize: 11, color: dm ? '#636366' : '#aeaeb2', marginTop: 5, textAlign: 'center' }}>Unit # (optional)</div>
                  </div>
                  </div>
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
