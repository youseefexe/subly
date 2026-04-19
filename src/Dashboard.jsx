import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { SublyWordmark } from './Logo'
import { UserAvatar } from './Avatars'
import Messages from './Messages'
import { parseTags } from './utils'
import { RangeDatePicker, fmtDate, parseDateRange, sod } from './DateRangePicker'

const EDIT_TAGS = ['Utilities included', 'In-unit washer/dryer', 'Parking included', 'Pet friendly', 'Furnished', 'A/C', 'Dishwasher', 'Gym access', 'Near bus line', 'Private bathroom', 'Short term ok', 'Bills split', 'Negotiable']
const EDIT_NEIGHBORHOODS = ['Central Campus', 'North Campus', 'South Campus', 'Kerrytown', 'Burns Park', 'Old West Side', 'Downtown Ann Arbor', 'Near Northside', 'Water Hill', 'Other']

const getCoverImage = (raw) => {
  if (!raw) return null
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p[0] : raw } catch { return raw }
}

const fmt = (ts) => {
  if (!ts) return ''
  const d = new Date(ts), now = new Date(), diff = now - d
  if (diff < 86400000) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function Dashboard({ user, onBack, onPost, onBrowse, onBrowseMine, darkMode, onToggleDark }) {
  const dm = darkMode
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')
  const [editingListing, setEditingListing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editImages, setEditImages] = useState([])
  const [newImages, setNewImages] = useState([])
  const [saveStatus, setSaveStatus] = useState('idle')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [editStartDate, setEditStartDate] = useState(null)
  const [editEndDate, setEditEndDate] = useState(null)
  const [editSelectedTags, setEditSelectedTags] = useState([])
  const msgChannelRef = useRef(null)
  const userMenuRef = useRef(null)

  const username = user?.email?.split('@')[0] || 'there'
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const totalImages = editImages.length + newImages.length

  useEffect(() => {
    if (user?.id) fetchMyListings()
    supabase.from('messages').select('id', { count: 'exact', head: true })
      .eq('recipient_id', user?.id).eq('read', false)
      .then(({ count }) => setUnreadCount(count || 0)).catch(() => {})

    if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null }
    try {
      const ch = supabase.channel(`dash-msgs-${user?.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
          if (p.new?.recipient_id === user?.id) setUnreadCount(c => c + 1)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
          supabase.from('messages').select('id', { count: 'exact', head: true })
            .eq('recipient_id', user?.id).eq('read', false)
            .then(({ count }) => setUnreadCount(count || 0)).catch(() => {})
        })
        .subscribe()
      msgChannelRef.current = ch
    } catch (e) {}

    const onOutside = (e) => { if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false) }
    document.addEventListener('mousedown', onOutside)
    return () => {
      if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null }
      document.removeEventListener('mousedown', onOutside)
    }
  }, [user?.id])

  const fetchMyListings = async () => {
    if (!user?.id) return
    console.log('[Dashboard] fetchMyListings — user.id:', user?.id)
    setLoading(true)
    const { data, error } = await supabase.from('listings').select('*').eq('user_id', user?.id).order('created_at', { ascending: false })
    console.log('[Dashboard] listings result:', { data, error, userId: user?.id })
    if (!error && data) setListings(data)
    else if (error) console.error('[Dashboard] listings fetch error:', error)
    setLoading(false)
  }

  const handleToggleFilled = async (listing) => {
    const newVal = !listing.filled
    const { error } = await supabase.from('listings').update({ filled: newVal }).eq('id', listing.id)
    if (!error) setListings(prev => prev.map(l => l.id === listing.id ? { ...l, filled: newVal } : l))
  }

  const handleDelete = async (id) => {
    setDeletingId(id)
    const { error } = await supabase.from('listings').delete().eq('id', id)
    if (!error) { setListings(prev => prev.filter(l => l.id !== id)); setConfirmDelete(null) }
    setDeletingId(null)
  }

  const startEdit = (listing) => {
    setEditingListing(listing)
    setEditForm({
      title: listing.title || '',
      address: listing.address || '',
      unit_number: listing.unit_number || '',
      building_name: listing.building_name || '',
      price: listing.price || '',
      beds: listing.beds || 'Studio',
      neighborhood: listing.neighborhood || '',
      description: listing.description || '',
      contact_email: listing.contact_email || '',
    })
    // Parse image URLs from JSON array format
    let existing = []
    if (listing.image_url) {
      try { const p = JSON.parse(listing.image_url); existing = Array.isArray(p) ? p : [listing.image_url] }
      catch { existing = [listing.image_url] }
    }
    setEditImages(existing)
    setNewImages([])
    // Parse tags
    setEditSelectedTags(parseTags(listing.tags) || [])
    // Parse date range
    const [s, e] = parseDateRange(listing.dates)
    setEditStartDate(s)
    setEditEndDate(e)
  }

  const handleNewImages = (files) => {
    const combined = [...newImages]
    for (const file of Array.from(files)) {
      if (combined.length + editImages.length >= 5) break
      if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) continue
      combined.push({ file, preview: URL.createObjectURL(file) })
    }
    setNewImages(combined)
  }

  const handleSave = async () => {
    setSaveStatus('loading')
    const uploadedUrls = []
    for (const img of newImages) {
      const ext = img.file.name.split('.').pop()
      const filename = `${user?.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: ue } = await supabase.storage.from('listing-images').upload(filename, img.file)
      if (!ue) { const { data } = supabase.storage.from('listing-images').getPublicUrl(filename); uploadedUrls.push(data.publicUrl) }
    }
    const allImageUrls = [...editImages, ...uploadedUrls]
    const formattedDates = editStartDate && editEndDate
      ? `${fmtDate(editStartDate)} to ${fmtDate(editEndDate)}`
      : ''
    const updateData = {
      title: editForm.title,
      address: editForm.address,
      unit_number: editForm.unit_number || null,
      building_name: editForm.building_name || null,
      price: parseInt(editForm.price),
      beds: editForm.beds,
      neighborhood: editForm.neighborhood || null,
      description: editForm.description,
      contact_email: editForm.contact_email,
      dates: formattedDates,
      tags: editSelectedTags.length > 0 ? JSON.stringify(editSelectedTags) : null,
      image_url: allImageUrls.length > 0 ? JSON.stringify(allImageUrls) : null,
    }
    const { error } = await supabase.from('listings').update(updateData).eq('id', editingListing.id)
    if (!error) {
      setListings(prev => prev.map(l => l.id === editingListing.id ? { ...l, ...updateData, image_url: updateData.image_url } : l))
      setSaveStatus('success')
      setTimeout(() => { setEditingListing(null); setSaveStatus('idle') }, 1000)
    } else setSaveStatus('idle')
  }

  const updateEdit = (f, v) => setEditForm(x => ({ ...x, [f]: v }))

  // ── shared styles ──
  const bg = dm ? '#0f0f11' : '#f5f5f7'
  const card = dm ? '#1c1c1e' : '#fff'
  const border = dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'
  const tp = dm ? '#f5f5f7' : '#1d1d1f'
  const ts = dm ? '#8e8e93' : '#6e6e73'
  const tf = dm ? '#636366' : '#aeaeb2'

  const navH = 60
  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'listings', label: 'My Listings' },
    { id: 'messages', label: 'Messages' },
    { id: 'account', label: 'Account' },
  ]

  const switchTab = (id) => { setActiveTab(id); if (id === 'messages') setUnreadCount(0) }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }

        .db-tab { background: none; border: none; font-family: inherit; cursor: pointer; padding: 6px 14px; border-radius: 8px; font-size: 14px; font-weight: 500; transition: all 0.15s; white-space: nowrap; position: relative; }
        .db-tab.active { font-weight: 700; }

        .field-input { width: 100%; background: #f7f7f8; border: 1.5px solid transparent; border-radius: 10px; padding: 11px 14px; font-size: 14px; font-family: inherit; color: #1d1d1f; transition: all 0.2s; outline: none; }
        .field-input:focus { background: #fff; border-color: #00274C; box-shadow: 0 0 0 3px rgba(0,39,76,0.08); }
        .field-input::placeholder { color: #aeaeb2; }
        [data-theme="dark"] .field-input { background: #2c2c2e; border-color: rgba(255,255,255,0.1); color: #f5f5f7; }
        [data-theme="dark"] .field-input::placeholder { color: #636366; }
        [data-theme="dark"] .field-input:focus { border-color: #FFCB05; box-shadow: 0 0 0 3px rgba(255,203,5,0.1); }

        .listing-card { background: #fff; border-radius: 16px; border: 1px solid rgba(0,0,0,0.07); overflow: hidden; transition: box-shadow 0.2s, transform 0.2s; }
        .listing-card:hover { box-shadow: 0 8px 32px rgba(0,39,76,0.12); transform: translateY(-2px); }
        [data-theme="dark"] .listing-card { background: #1c1c1e; border-color: rgba(255,255,255,0.08); }
        [data-theme="dark"] .listing-card:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.35); }

        .btn-primary { background: #00274C; color: #FFCB05; border: none; border-radius: 980px; padding: 10px 22px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; letter-spacing: -0.01em; }
        .btn-primary:hover { background: #003a6e; box-shadow: 0 6px 20px rgba(0,39,76,0.22); transform: translateY(-1px); }
        .btn-primary:active { transform: scale(0.98); }
        .btn-danger { background: rgba(255,59,48,0.08); color: #ff3b30; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
        .btn-danger:hover { background: rgba(255,59,48,0.14); }
        .btn-edit { background: rgba(0,39,76,0.06); color: #00274C; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
        .btn-edit:hover { background: rgba(0,39,76,0.1); }
        [data-theme="dark"] .btn-edit { background: rgba(255,203,5,0.1); color: #FFCB05; }
        .btn-filled { background: rgba(0,0,0,0.05); color: #6e6e73; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background 0.15s; }
        .btn-filled:hover { background: rgba(0,0,0,0.09); }
        [data-theme="dark"] .btn-filled { background: rgba(255,255,255,0.08); color: #8e8e93; }

        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 400; display: flex; align-items: center; justify-content: center; padding: 20px; backdrop-filter: blur(8px); }
        .modal { background: #fff; border-radius: 24px; width: 100%; max-width: 680px; max-height: 92vh; overflow-y: auto; box-shadow: 0 32px 80px rgba(0,0,0,0.25); display: flex; flex-direction: column; }
        [data-theme="dark"] .modal { background: #1c1c1e; }
        .edit-section { display: flex; flex-direction: column; gap: 6px; }
        .edit-label { font-size: 11px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
        .edit-tag-pill { padding: 7px 14px; border-radius: 980px; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: inherit; border: 1.5px solid; }
        @media (max-width: 560px) {
          .cal-grid { flex-direction: column !important; padding: 14px !important; }
          .cal-divider { width: 100% !important; height: 1px !important; margin: 14px 0 !important; }
        }

        .img-thumb { position: relative; border-radius: 10px; overflow: hidden; aspect-ratio: 1; }
        .img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .img-thumb .rm { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; border: none; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; font-family: inherit; }
        .img-thumb:hover .rm { opacity: 1; }
        .drop-zone { border: 2px dashed rgba(0,39,76,0.2); border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: #f7f7f8; }
        .drop-zone:hover { border-color: #00274C; background: rgba(0,39,76,0.03); }
        [data-theme="dark"] .drop-zone { background: #2c2c2e; border-color: rgba(255,255,255,0.15); }
        [data-theme="dark"] .drop-zone:hover { border-color: #FFCB05; background: rgba(255,203,5,0.05); }

        .quick-action-card { border-radius: 18px; border: 1.5px solid; padding: 28px; cursor: pointer; transition: all 0.2s; text-align: left; background: none; font-family: inherit; width: 100%; }
        .quick-action-card:hover { transform: translateY(-2px); }

        .dark-toggle-btn { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; border: 1.5px solid; }
        .dark-toggle-btn:hover { transform: scale(1.1); }
        .db-avatar { transition: transform 0.2s ease, box-shadow 0.15s !important; }
        .db-avatar:hover { transform: scale(1.08) !important; }

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

        .user-row-btn { width: 100%; padding: 10px 16px; background: none; border: none; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; text-align: left; display: flex; align-items: center; gap: 10px; transition: background 0.12s; }

        /* Mobile bottom nav */
        .db-bottom-nav { display: none; }
        @media (max-width: 900px) {
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .db-tab-bar { display: none !important; }
          .db-bottom-nav { display: flex !important; position: fixed; bottom: 0; left: 0; right: 0; height: 60px; z-index: 100; border-top: 1px solid; align-items: stretch; }
          .db-content { padding: 20px 16px 80px !important; }
          .stat-grid { grid-template-columns: 1fr 1fr !important; }
          .quick-grid { grid-template-columns: 1fr !important; }
          .modal { max-width: 100% !important; border-radius: 16px 16px 0 0 !important; }
          .modal-overlay { padding: 0 !important; align-items: flex-end !important; }
        }
        @media (max-width: 440px) {
          .stat-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: bg, fontFamily: 'Inter, sans-serif', display: 'flex', flexDirection: 'column' }}>

        {/* ── TOP NAV ── */}
        <header style={{ background: card, borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, zIndex: 200, flexShrink: 0 }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', height: navH, display: 'flex', alignItems: 'center', gap: 24 }}>

            {/* Logo */}
            <SublyWordmark size={26} onClick={onBack} light={dm} />

            {/* Tabs */}
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <nav className="db-tab-bar" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {TABS.map(tab => (
                  <button key={tab.id} className={`db-tab${activeTab === tab.id ? ' active' : ''}`}
                    onClick={() => switchTab(tab.id)}
                    style={{ color: activeTab === tab.id ? (dm ? '#FFCB05' : '#00274C') : ts }}>
                    {tab.label}
                    {tab.id === 'messages' && unreadCount > 0 && (
                      <span style={{ marginLeft: 6, background: '#00274C', color: '#FFCB05', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 980, verticalAlign: 'middle' }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {activeTab === tab.id && (
                      <span style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', width: '60%', height: 2, background: dm ? '#FFCB05' : '#00274C', borderRadius: 2, display: 'block' }} />
                    )}
                  </button>
                ))}
              </nav>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

              {/* Avatar + user menu */}
              <div ref={userMenuRef} style={{ position: 'relative' }}>
                <div onClick={() => setShowUserMenu(p => !p)}
                  className="db-avatar"
                  style={{ width: 34, height: 34, borderRadius: '50%', background: '#00274C', overflow: 'hidden', cursor: 'pointer', flexShrink: 0, boxShadow: showUserMenu ? '0 0 0 3px rgba(0,39,76,0.2)' : '0 2px 8px rgba(0,39,76,0.2)', transition: 'box-shadow 0.15s, transform 0.2s ease', userSelect: 'none' }}>
                  <UserAvatar />
                </div>
                {showUserMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: card, borderRadius: 14, boxShadow: '0 12px 48px rgba(0,0,0,0.18)', border: `1px solid ${border}`, overflow: 'hidden', minWidth: 200, zIndex: 300 }}>
                    <div style={{ padding: '12px 16px 10px', borderBottom: `1px solid ${border}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tp }}>{username}</div>
                      <div style={{ fontSize: 11, color: tf }}>{user?.email}</div>
                    </div>
                    {[
                      { label: 'Overview', icon: '🏠', tab: 'overview' },
                      { label: 'My Listings', icon: '📋', tab: 'listings' },
                      { label: 'Messages', icon: '✉️', tab: 'messages' },
                      { label: 'Account', icon: '👤', tab: 'account' },
                    ].map(item => (
                      <button key={item.label} className="user-row-btn"
                        onClick={() => { setShowUserMenu(false); switchTab(item.tab) }}
                        style={{ color: tp }}
                        onMouseEnter={e => e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,39,76,0.04)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: border }} />
                    <button className="user-row-btn" onClick={onToggleDark}
                      style={{ color: tp, justifyContent: 'space-between' }}
                      onMouseEnter={e => e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,39,76,0.04)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 15 }}>{dm ? '☀️' : '🌙'}</span>
                        <span>{dm ? 'Light Mode' : 'Dark Mode'}</span>
                      </div>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: dm ? '#FFCB05' : '#d2d2d7', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 2, left: dm ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: dm ? '#00274C' : '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </button>
                    <div style={{ height: 1, background: border }} />
                    <button className="user-row-btn" onClick={async () => { setShowUserMenu(false); await supabase.auth.signOut(); onBack() }}
                      style={{ color: '#ff3b30' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ fontSize: 15 }}>🚪</span>Sign Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* ── CONTENT ── */}
        {activeTab === 'messages' ? (
          <div style={{ flex: 1, overflow: 'hidden', height: `calc(100vh - ${navH}px)` }}>
            <Messages user={user} darkMode={dm} />
          </div>
        ) : (
          <main className="db-content" style={{ flex: 1, maxWidth: 1100, width: '100%', margin: '0 auto', padding: '40px 24px 60px' }}>

            {/* ══ OVERVIEW ══ */}
            {activeTab === 'overview' && (
              <div>
                {/* Welcome header */}
                <div style={{ marginBottom: 36 }}>
                  <div style={{ fontSize: 13, color: tf, marginBottom: 8, fontWeight: 500 }}>{today}</div>
                  <h1 style={{ fontSize: 34, fontWeight: 800, color: tp, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 6 }}>
                    Welcome back, <span style={{ color: dm ? '#FFCB05' : '#00274C' }}>{username}</span> 👋
                  </h1>
                  <p style={{ fontSize: 15, color: ts }}>Here's what's happening with your listings.</p>
                </div>

                {/* Stat cards */}
                <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 36 }}>
                  {[
                    { label: 'Active Listings', value: listings.filter(l => l.filled !== true).length, icon: '🏠', sub: `${listings.length} total`, accent: dm ? '#FFCB05' : '#00274C' },
                    { label: 'Unread Messages', value: unreadCount, icon: '✉️', sub: unreadCount === 0 ? 'All caught up' : 'Tap to view', accent: unreadCount > 0 ? '#ff3b30' : (dm ? '#FFCB05' : '#00274C'), clickTab: unreadCount > 0 ? 'messages' : null },
                    { label: 'Profile Status', value: '✓', icon: '🎓', sub: 'UMich verified', accent: '#34c759' },
                  ].map(s => (
                    <div key={s.label} onClick={s.clickTab ? () => switchTab(s.clickTab) : undefined}
                      style={{ background: card, borderRadius: 18, border: `1px solid ${border}`, padding: '24px', cursor: s.clickTab ? 'pointer' : 'default', transition: 'box-shadow 0.2s' }}
                      onMouseEnter={e => { if (s.clickTab) e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,39,76,0.1)' }}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: tf, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: dm ? 'rgba(255,255,255,0.06)' : '#f5f5f7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{s.icon}</div>
                      </div>
                      {loading && s.label === 'Active Listings' ? (
                        <div className="skeleton" style={{ height: 40, width: 60, borderRadius: 8, marginBottom: 6 }} />
                      ) : (
                        <div style={{ fontSize: 38, fontWeight: 900, color: s.accent, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
                      )}
                      <div style={{ fontSize: 12, color: ts }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Quick Actions */}
                <div style={{ marginBottom: 36 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: tp, marginBottom: 14, letterSpacing: '-0.01em' }}>Quick Actions</h2>
                  <div className="quick-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <button className="quick-action-card" onClick={onPost}
                      style={{ borderColor: dm ? 'rgba(255,203,5,0.25)' : 'rgba(0,39,76,0.15)', background: dm ? 'rgba(255,203,5,0.05)' : 'rgba(0,39,76,0.02)' }}
                      onMouseEnter={e => e.currentTarget.style.background = dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = dm ? 'rgba(255,203,5,0.05)' : 'rgba(0,39,76,0.02)'}>
                      <div style={{ fontSize: 32, marginBottom: 14 }}>➕</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: dm ? '#FFCB05' : '#00274C', marginBottom: 6 }}>Post a New Listing</div>
                      <div style={{ fontSize: 13, color: ts, lineHeight: 1.5 }}>List your sublease and connect with UMich students looking for housing.</div>
                    </button>
                    <button className="quick-action-card" onClick={onBrowse}
                      style={{ borderColor: border, background: card }}
                      onMouseEnter={e => { e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.04)' : '#fafafa'; e.currentTarget.style.borderColor = dm ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = card; e.currentTarget.style.borderColor = border }}>
                      <div style={{ fontSize: 32, marginBottom: 14 }}>🔍</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: tp, marginBottom: 6 }}>Browse Listings</div>
                      <div style={{ fontSize: 13, color: ts, lineHeight: 1.5 }}>Explore all verified subleases from UMich students on the map or list view.</div>
                    </button>
                  </div>
                </div>

                {/* Recent Activity */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, color: tp, letterSpacing: '-0.01em' }}>Recent Listings</h2>
                    {listings.length > 0 && <button onClick={() => switchTab('listings')} style={{ background: 'none', border: 'none', fontSize: 13, color: dm ? '#FFCB05' : '#00274C', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>View all →</button>}
                  </div>
                  {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[1,2].map(n => (
                        <div key={n} className="listing-card" style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                          <div className="skeleton" style={{ width: 80, height: 72, flexShrink: 0 }} />
                          <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <div className="skeleton" style={{ height: 14, width: '55%', borderRadius: 6 }} />
                            <div className="skeleton" style={{ height: 12, width: '35%', borderRadius: 6 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : listings.length === 0 ? (
                    <div style={{ background: card, borderRadius: 18, border: `2px dashed ${border}`, padding: '52px 24px', textAlign: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>🏠</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: tp, marginBottom: 6, letterSpacing: '-0.01em' }}>No listings yet</div>
                      <p style={{ fontSize: 13, color: ts, marginBottom: 20, lineHeight: 1.5 }}>Post your first sublease and start connecting with UMich students.</p>
                      <button className="btn-primary" onClick={onPost}>Post your first listing</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {listings.slice(0, 3).map(listing => (
                        <div key={listing.id} className="listing-card" style={{ display: 'flex', alignItems: 'center', gap: 0, cursor: 'pointer' }} onClick={() => onBrowse(listing)}>
                          <div style={{ width: 80, height: 72, flexShrink: 0, background: dm ? '#2c2c2e' : '#f0f0f5', overflow: 'hidden' }}>
                            {getCoverImage(listing.image_url)
                              ? <img src={getCoverImage(listing.image_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🏠</div>
                            }
                          </div>
                          <div style={{ flex: 1, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: 14, fontWeight: 600, color: tp, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</div>
                              <div style={{ fontSize: 12, color: ts }}>{listing.beds}{listing.neighborhood ? ` · ${listing.neighborhood}` : ''}</div>
                            </div>
                            <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 15, fontWeight: 800, color: dm ? '#FFCB05' : '#00274C' }}>${listing.price}<span style={{ fontSize: 11, fontWeight: 400, color: tf }}>/mo</span></div>
                                {listing.filled && <span style={{ fontSize: 10, fontWeight: 600, background: dm ? 'rgba(255,255,255,0.1)' : '#e5e5ea', color: ts, padding: '1px 6px', borderRadius: 980 }}>Filled</span>}
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); startEdit(listing) }}
                                style={{ background: 'none', border: `1.5px solid ${dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.14)'}`, borderRadius: 980, padding: '3px 10px', fontSize: 12, fontWeight: 500, color: dm ? 'rgba(255,255,255,0.45)' : '#8e8e93', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, transition: 'border-color 0.15s, color 0.15s' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = dm ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.28)'; e.currentTarget.style.color = dm ? 'rgba(255,255,255,0.85)' : '#1d1d1f' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.14)'; e.currentTarget.style.color = dm ? 'rgba(255,255,255,0.45)' : '#8e8e93' }}
                              >
                                ✏️ Edit
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ══ MY LISTINGS ══ */}
            {activeTab === 'listings' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                  <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: tp, letterSpacing: '-0.03em', marginBottom: 4 }}>My Listings</h1>
                    <p style={{ fontSize: 14, color: ts }}>Manage your subleases in one place.</p>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {listings.length > 0 && (
                      <button onClick={onBrowseMine} style={{ background: dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.06)', color: dm ? '#FFCB05' : '#00274C', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = dm ? 'rgba(255,203,5,0.18)' : 'rgba(0,39,76,0.1)'}
                        onMouseLeave={e => e.currentTarget.style.background = dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.06)'}>
                        🔍 View My Listings
                      </button>
                    )}
                    <button className="btn-primary" onClick={onPost}>+ New Listing</button>
                  </div>
                </div>

                {loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1,2].map(n => (
                      <div key={n} className="listing-card" style={{ display: 'flex', alignItems: 'stretch', overflow: 'hidden' }}>
                        <div className="skeleton" style={{ width: 130, minHeight: 120, flexShrink: 0 }} />
                        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <div className="skeleton" style={{ height: 16, width: '60%', borderRadius: 6 }} />
                          <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 6 }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <div className="skeleton" style={{ height: 20, width: 50, borderRadius: 980 }} />
                            <div className="skeleton" style={{ height: 20, width: 70, borderRadius: 980 }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : listings.length === 0 ? (
                  <div style={{ background: card, borderRadius: 18, border: `2px dashed ${border}`, padding: '64px 24px', textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 36 }}>🏠</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: tp, marginBottom: 8, letterSpacing: '-0.02em' }}>No listings yet</div>
                    <p style={{ fontSize: 14, color: ts, marginBottom: 28, lineHeight: 1.6, maxWidth: 320, margin: '0 auto 28px' }}>Post your first sublease and start connecting with UMich students looking for housing.</p>
                    <button className="btn-primary" onClick={onPost}>+ Post your first listing</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {listings.map(listing => (
                      <div key={listing.id} className="listing-card">
                        <div style={{ display: 'flex' }}>
                          <div style={{ width: 130, flexShrink: 0, background: dm ? '#2c2c2e' : '#f5f5f7', overflow: 'hidden' }}>
                            {getCoverImage(listing.image_url)
                              ? <img src={getCoverImage(listing.image_url)} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 120 }} />
                              : <div style={{ width: '100%', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🏠</div>
                            }
                          </div>
                          <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                                  <h3 style={{ fontSize: 15, fontWeight: 700, color: tp, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listing.title}</h3>
                                  {listing.filled && <span style={{ fontSize: 11, fontWeight: 600, background: dm ? 'rgba(255,255,255,0.1)' : '#e5e5ea', color: ts, padding: '2px 8px', borderRadius: 980, whiteSpace: 'nowrap', flexShrink: 0 }}>Filled</span>}
                                </div>
                                <span style={{ fontSize: 16, fontWeight: 800, color: dm ? '#FFCB05' : '#00274C', flexShrink: 0, marginLeft: 8 }}>${listing.price}<span style={{ fontSize: 12, fontWeight: 400, color: tf }}>/mo</span></span>
                              </div>
                              <p style={{ fontSize: 13, color: ts, marginBottom: 8 }}>📍 {listing.address}{listing.unit_number ? `, ${listing.unit_number}` : ''}</p>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, background: dm ? 'rgba(255,255,255,0.1)' : '#f5f5f7', color: ts, padding: '3px 9px', borderRadius: 980 }}>{listing.beds}</span>
                                {listing.neighborhood && <span style={{ fontSize: 11, background: dm ? 'rgba(255,203,5,0.1)' : 'rgba(0,39,76,0.07)', color: dm ? '#FFCB05' : '#00274C', padding: '3px 9px', borderRadius: 980 }}>📍 {listing.neighborhood}</span>}
                                {listing.dates && <span style={{ fontSize: 11, background: 'rgba(255,203,5,0.12)', color: dm ? '#c9a600' : '#7a5c00', padding: '3px 9px', borderRadius: 980 }}>{listing.dates}</span>}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                              <button className="btn-filled" onClick={() => handleToggleFilled(listing)}>{listing.filled ? '↩ Mark Available' : '✓ Mark Filled'}</button>
                              <button className="btn-edit" onClick={() => startEdit(listing)}>✏️ Edit</button>
                              <button className="btn-danger" onClick={() => setConfirmDelete(listing)}>🗑️ Delete</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ══ ACCOUNT ══ */}
            {activeTab === 'account' && (() => {
              const memberSince = user?.created_at
                ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : 'N/A'
              const activeListings = listings.filter(l => !l.filled).length

              const detailRows = [
                { label: 'Email', value: user?.email },
                { label: 'University', value: 'University of Michigan' },
                { label: 'Verification Status', value: '✓ Verified', valueColor: '#34c759' },
                { label: 'Account Type', value: 'Student' },
              ]

              return (
                <div style={{ maxWidth: 720, margin: '0 auto' }}>

                  {/* ── Profile Header Card ── */}
                  <div style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
                    <div style={{ background: 'linear-gradient(135deg, #001a36 0%, #00274C 45%, #003a6e 100%)', padding: '52px 40px 40px', textAlign: 'center', position: 'relative' }}>
                      {/* Subtle pattern overlay */}
                      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 20% 80%, rgba(255,203,5,0.07) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.04) 0%, transparent 50%)', pointerEvents: 'none' }} />

                      {/* Avatar */}
                      <div style={{ position: 'relative', display: 'inline-block', marginBottom: 20 }}>
                        <div style={{ width: 96, height: 96, borderRadius: '50%', background: '#00274C', overflow: 'hidden', boxShadow: '0 0 0 4px rgba(255,203,5,0.25), 0 8px 24px rgba(0,0,0,0.3)' }}>
                          <UserAvatar />
                        </div>
                        <div style={{ position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: '50%', background: '#34c759', border: '3px solid #00274C', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                      </div>

                      {/* Name & email */}
                      <h2 style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', marginBottom: 6 }}>{username}</h2>
                      <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginBottom: 20, letterSpacing: '0.01em' }}>{user?.email}</p>

                      {/* Verified badge */}
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(52,199,89,0.18)', border: '1px solid rgba(52,199,89,0.35)', borderRadius: 980, padding: '6px 16px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34c759', flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', letterSpacing: '0.01em' }}>UMich Verified</span>
                      </div>
                    </div>
                  </div>

                  {/* ── Stat Cards ── */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Listings Posted', value: listings.length, sub: `${activeListings} active` },
                      { label: 'Member Since', value: memberSince.split(' ')[0], sub: memberSince.split(' ')[1] || '' },
                      { label: 'Account Status', value: 'Active', valueColor: '#34c759', sub: 'In good standing' },
                    ].map(s => (
                      <div key={s.label} style={{ background: card, borderRadius: 18, border: `1px solid ${border}`, padding: '20px 20px 18px', textAlign: 'center' }}>
                        <div style={{ fontSize: s.label === 'Member Since' ? 22 : 28, fontWeight: 800, color: s.valueColor || (dm ? '#FFCB05' : '#00274C'), letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: 4 }}>{s.value}</div>
                        {s.label === 'Member Since' && s.sub && (
                          <div style={{ fontSize: 16, fontWeight: 700, color: s.valueColor || (dm ? '#FFCB05' : '#00274C'), letterSpacing: '-0.02em', marginBottom: 4 }}>{s.sub}</div>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 600, color: tf, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: s.label !== 'Member Since' ? 2 : 0 }}>{s.label}</div>
                        {s.label !== 'Member Since' && <div style={{ fontSize: 12, color: ts }}>{s.sub}</div>}
                      </div>
                    ))}
                  </div>

                  {/* ── Profile Details ── */}
                  <div style={{ background: card, borderRadius: 20, border: `1px solid ${border}`, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${border}` }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: tp, letterSpacing: '-0.01em' }}>Profile Details</h3>
                    </div>
                    <div style={{ padding: '0 24px' }}>
                      {detailRows.map((row, i) => (
                        <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderBottom: i < detailRows.length - 1 ? `1px solid ${border}` : 'none' }}>
                          <span style={{ fontSize: 14, color: ts, fontWeight: 500 }}>{row.label}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: row.valueColor || tp }}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Security ── */}
                  <div style={{ background: card, borderRadius: 20, border: `1px solid ${border}`, overflow: 'hidden', marginBottom: 16 }}>
                    <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${border}` }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: tp, letterSpacing: '-0.01em' }}>Security</h3>
                    </div>
                    <div style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: tp, marginBottom: 3 }}>Password</div>
                          <div style={{ fontSize: 13, color: ts }}>Update your account password</div>
                        </div>
                        <button
                          onClick={async () => {
                            const { error } = await supabase.auth.resetPasswordForEmail(user?.email, { redirectTo: window.location.origin })
                            if (!error) alert('Password reset email sent to ' + user?.email)
                          }}
                          style={{ background: dm ? 'rgba(255,255,255,0.07)' : '#f5f5f7', color: tp, border: `1px solid ${border}`, borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                          onMouseEnter={e => e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.12)' : '#ebebeb'}
                          onMouseLeave={e => e.currentTarget.style.background = dm ? 'rgba(255,255,255,0.07)' : '#f5f5f7'}>
                          Change Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── Danger Zone ── */}
                  <div style={{ background: dm ? 'rgba(255,59,48,0.06)' : 'rgba(255,59,48,0.03)', borderRadius: 20, border: '1px solid rgba(255,59,48,0.15)', padding: '24px' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#ff3b30', marginBottom: 6, letterSpacing: '-0.01em' }}>Danger Zone</h3>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: tp, marginBottom: 3 }}>Sign out of Subly</div>
                        <div style={{ fontSize: 13, color: ts }}>You'll need your UMich email to sign back in.</div>
                      </div>
                      <button
                        onClick={async () => { await supabase.auth.signOut(); onBack() }}
                        style={{ background: 'transparent', color: '#ff3b30', border: '1.5px solid rgba(255,59,48,0.5)', borderRadius: 10, padding: '10px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,59,48,0.08)'; e.currentTarget.style.borderColor = '#ff3b30' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,59,48,0.5)' }}>
                        Sign Out
                      </button>
                    </div>
                  </div>

                </div>
              )
            })()}

          </main>
        )}

        {/* ── MOBILE BOTTOM NAV ── */}
        <div className="db-bottom-nav" style={{ background: card, borderTopColor: border }}>
          {[
            { id: 'overview', icon: '🏠', label: 'Home' },
            { id: 'listings', icon: '📋', label: 'Listings' },
            { id: 'messages', icon: '✉️', label: 'Messages' },
            { id: 'account', icon: '👤', label: 'Account' },
          ].map(tab => (
            <button key={tab.id} onClick={() => switchTab(tab.id)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: activeTab === tab.id ? (dm ? '#FFCB05' : '#00274C') : ts, position: 'relative' }}>
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              {tab.id === 'messages' && unreadCount > 0 && <span style={{ position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)', background: '#ff3b30', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 4px', borderRadius: 980, minWidth: 14, textAlign: 'center' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
              <span style={{ fontSize: 10, fontWeight: activeTab === tab.id ? 700 : 500 }}>{tab.label}</span>
            </button>
          ))}
        </div>

      </div>

      {/* ── EDIT MODAL ── */}
      {editingListing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingListing(null)}>
          <div className="modal">

            {/* Header — sticky */}
            <div style={{ padding: '22px 28px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${border}`, position: 'sticky', top: 0, background: card, zIndex: 10, borderRadius: '24px 24px 0 0', flexShrink: 0 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: tp, letterSpacing: '-0.02em' }}>Edit Listing</h2>
                <p style={{ fontSize: 12, color: tf, marginTop: 2 }}>Changes save immediately to your live listing.</p>
              </div>
              <button onClick={() => setEditingListing(null)} style={{ width: 32, height: 32, borderRadius: '50%', background: dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', border: 'none', fontSize: 18, color: ts, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
            </div>

            {/* Scrollable body */}
            <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: 28, overflowY: 'auto', flex: 1 }}>

              {/* ── Photos ── */}
              <div className="edit-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="edit-label" style={{ color: ts }}>Photos</label>
                  <span style={{ fontSize: 12, color: totalImages >= 5 ? '#ff3b30' : tf, fontWeight: 500 }}>{totalImages} / 5</span>
                </div>
                {totalImages > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    {editImages.map((url, i) => (
                      <div key={`ex-${i}`} className="img-thumb">
                        <img src={url} alt="" />
                        {i === 0 && <div style={{ position: 'absolute', bottom: 5, left: 5, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 9, padding: '2px 7px', borderRadius: 980, fontWeight: 700, letterSpacing: '0.04em' }}>COVER</div>}
                        <button className="rm" onClick={() => setEditImages(p => p.filter((_, j) => j !== i))}>×</button>
                      </div>
                    ))}
                    {newImages.map((img, i) => (
                      <div key={`new-${i}`} className="img-thumb">
                        <img src={img.preview} alt="" />
                        <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(0,113,227,0.85)', color: '#fff', fontSize: 9, padding: '2px 7px', borderRadius: 980, fontWeight: 700, letterSpacing: '0.04em' }}>NEW</div>
                        <button className="rm" onClick={() => setNewImages(p => p.filter((_, j) => j !== i))}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                {totalImages < 5 && (
                  <div className="drop-zone" onClick={() => document.getElementById('edit-img-input').click()} style={{ padding: '20px', marginTop: totalImages > 0 ? 4 : 0 }}>
                    <div style={{ fontSize: 22, marginBottom: 6 }}>📷</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: dm ? '#FFCB05' : '#00274C', marginBottom: 2 }}>{totalImages === 0 ? 'Add photos' : 'Add more photos'}</div>
                    <div style={{ fontSize: 11, color: tf }}>Up to 5 photos · 5MB each</div>
                  </div>
                )}
                <input id="edit-img-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleNewImages(e.target.files)} />
              </div>

              {/* ── Title ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Listing Title</label>
                <input className="field-input" placeholder="Studio near Central Campus" value={editForm.title || ''} onChange={e => updateEdit('title', e.target.value)} />
              </div>

              {/* ── Building / Complex Name ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Building / Complex Name</label>
                <input className="field-input" placeholder="e.g. Oxford Housing, The Yard — leave blank if not applicable" value={editForm.building_name || ''} onChange={e => updateEdit('building_name', e.target.value)} />
              </div>

              {/* ── Address + Unit # ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Address</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input className="field-input" placeholder="523 E William St" value={editForm.address || ''} onChange={e => updateEdit('address', e.target.value)} style={{ flex: '0 0 75%' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input className="field-input" placeholder="Apt 4B" value={editForm.unit_number || ''} onChange={e => updateEdit('unit_number', e.target.value)} />
                    <span style={{ fontSize: 11, color: tf, textAlign: 'center' }}>Unit # (optional)</span>
                  </div>
                </div>
              </div>

              {/* ── Neighborhood ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Neighborhood</label>
                <select className="field-input" value={editForm.neighborhood || ''} onChange={e => updateEdit('neighborhood', e.target.value)}>
                  <option value="">Select…</option>
                  {EDIT_NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {/* ── Price + Beds ── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="edit-section">
                  <label className="edit-label" style={{ color: ts }}>Monthly Rent ($)</label>
                  <input className="field-input" type="number" placeholder="875" value={editForm.price || ''} onChange={e => updateEdit('price', e.target.value)} />
                </div>
                <div className="edit-section">
                  <label className="edit-label" style={{ color: ts }}>Bedrooms</label>
                  <select className="field-input" value={editForm.beds || 'Studio'} onChange={e => updateEdit('beds', e.target.value)}>
                    {['Studio', '1 Bed', '2 Bed', '3 Bed', '4+ Bed'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              {/* ── Available Dates ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Available Dates</label>
                <RangeDatePicker
                  startDate={editStartDate}
                  endDate={editEndDate}
                  onStart={setEditStartDate}
                  onEnd={setEditEndDate}
                  dm={dm}
                />
              </div>

              {/* ── Description ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Description</label>
                <textarea className="field-input" rows={4} placeholder="Describe your place, amenities, distance to campus…" value={editForm.description || ''} onChange={e => updateEdit('description', e.target.value)} style={{ resize: 'vertical' }} />
              </div>

              {/* ── Amenities & Tags ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Amenities & Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {EDIT_TAGS.map(tag => {
                    const on = editSelectedTags.includes(tag)
                    return (
                      <button key={tag} type="button" className="edit-tag-pill"
                        onClick={() => setEditSelectedTags(prev => on ? prev.filter(t => t !== tag) : [...prev, tag])}
                        style={{
                          borderColor: on ? '#00274C' : (dm ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.09)'),
                          background: on ? '#00274C' : (dm ? '#2c2c2e' : '#fff'),
                          color: on ? '#FFCB05' : (dm ? '#8e8e93' : '#6e6e73'),
                        }}>
                        {on ? '✓ ' : ''}{tag}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Contact Email ── */}
              <div className="edit-section">
                <label className="edit-label" style={{ color: ts }}>Contact Email</label>
                <input className="field-input" type="email" placeholder="you@umich.edu" value={editForm.contact_email || ''} onChange={e => updateEdit('contact_email', e.target.value)} />
              </div>

            </div>

            {/* Footer — sticky save button */}
            <div style={{ padding: '16px 28px 20px', borderTop: `1px solid ${border}`, position: 'sticky', bottom: 0, background: card, borderRadius: '0 0 24px 24px', flexShrink: 0 }}>
              <button onClick={handleSave} disabled={saveStatus === 'loading'} style={{ width: '100%', background: saveStatus === 'success' ? '#34c759' : '#00274C', color: saveStatus === 'success' ? '#fff' : '#FFCB05', border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 700, cursor: saveStatus === 'loading' ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all 0.2s', opacity: saveStatus === 'loading' ? 0.7 : 1 }}>
                {saveStatus === 'loading' ? 'Saving…' : saveStatus === 'success' ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🗑️</div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: tp, marginBottom: 8 }}>Delete this listing?</h2>
              <p style={{ fontSize: 14, color: ts, marginBottom: 28, lineHeight: 1.6 }}><strong>{confirmDelete.title}</strong> will be permanently removed.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: dm ? '#2c2c2e' : '#f5f5f7', color: tp, border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={() => handleDelete(confirmDelete.id)} disabled={deletingId === confirmDelete.id} style={{ flex: 1, background: '#ff3b30', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: deletingId === confirmDelete.id ? 0.6 : 1 }}>
                  {deletingId === confirmDelete.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
