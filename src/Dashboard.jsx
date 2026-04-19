import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { SublyWordmark } from './Logo'

const getCoverImage = (raw) => {
  if (!raw) return null
  try { const p = JSON.parse(raw); return Array.isArray(p) ? p[0] : raw } catch { return raw }
}

export default function Dashboard({ user, onBack, onPost, onBrowse, darkMode, onToggleDark }) {
  const dm = darkMode
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('listings')
  const [editingListing, setEditingListing] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [editImages, setEditImages] = useState([])
  const [newImages, setNewImages] = useState([])
  const [saveStatus, setSaveStatus] = useState('idle')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [showUserMenu, setShowUserMenu] = useState(false)

  useEffect(() => { fetchMyListings() }, [])

  const fetchMyListings = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('user_id', user?.id)
    if (!error && data) setListings(data)
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
      price: listing.price || '',
      beds: listing.beds || 'Studio',
      dates: listing.dates || '',
      description: listing.description || '',
      contact_email: listing.contact_email || '',
    })
    // existing images as array
    const existing = listing.image_url ? [listing.image_url] : []
    setEditImages(existing)
    setNewImages([])
  }

  const handleNewImages = (files) => {
    const incoming = Array.from(files)
    const combined = [...newImages]
    for (const file of incoming) {
      if (combined.length + editImages.length >= 5) break
      if (!file.type.startsWith('image/')) continue
      if (file.size > 5 * 1024 * 1024) continue
      combined.push({ file, preview: URL.createObjectURL(file) })
    }
    setNewImages(combined)
  }

  const removeExistingImage = (index) => {
    setEditImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeNewImage = (index) => {
    setNewImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaveStatus('loading')

    const uploadedUrls = []
    for (const img of newImages) {
      const ext = img.file.name.split('.').pop()
      const filename = `${user?.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await supabase.storage.from('listing-images').upload(filename, img.file)
      if (!uploadError) {
        const { data } = supabase.storage.from('listing-images').getPublicUrl(filename)
        uploadedUrls.push(data.publicUrl)
      }
    }

    const allImageUrls = [...editImages, ...uploadedUrls]

    const { error } = await supabase
      .from('listings')
      .update({
        ...editForm,
        price: parseInt(editForm.price),
        image_url: allImageUrls.length > 0 ? JSON.stringify(allImageUrls) : null,
      })
      .eq('id', editingListing.id)

    if (!error) {
      setListings(prev => prev.map(l => l.id === editingListing.id
        ? { ...l, ...editForm, price: parseInt(editForm.price), image_url: allImageUrls[0] || null }
        : l
      ))
      setSaveStatus('success')
      setTimeout(() => { setEditingListing(null); setSaveStatus('idle') }, 1000)
    } else { setSaveStatus('idle') }
  }

  const updateEdit = (field, val) => setEditForm(f => ({ ...f, [field]: val }))
  const initials = (() => { const u = user?.email?.split('@')[0] || 'U'; return (u[0] + (u[u.length - 1] || '')).toUpperCase() })()
  const totalImages = editImages.length + newImages.length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; background: #f7f7f8; }
        .field-input { width: 100%; background: #fff; border: 1.5px solid rgba(0,39,76,0.12); border-radius: 10px; padding: 11px 14px; font-size: 14px; font-family: inherit; color: #1d1d1f; transition: all 0.2s; outline: none; }
        .field-input:focus { border-color: #00274C; box-shadow: 0 0 0 3px rgba(0,39,76,0.08); }
        .field-input::placeholder { color: #c7c7cc; }
        .sidebar-link { display: flex; align-items: center; gap: 12px; padding: 10px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; color: #6e6e73; cursor: pointer; transition: all 0.15s; border: none; background: none; font-family: inherit; width: 100%; text-align: left; }
        .sidebar-link:hover { background: rgba(0,39,76,0.05); color: #00274C; }
        .sidebar-link.active { background: rgba(0,39,76,0.08); color: #00274C; font-weight: 600; }
        .listing-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0,0,0,0.07); overflow: hidden; transition: all 0.2s; }
        .listing-card:hover { box-shadow: 0 4px 20px rgba(0,39,76,0.08); }
        .btn-primary { background: #00274C; color: #FFCB05; border: none; border-radius: 10px; padding: 10px 20px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; transition: all 0.2s; }
        .btn-primary:hover { background: #003a6e; }
        .btn-danger { background: rgba(255,59,48,0.08); color: #ff3b30; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-edit { background: rgba(0,39,76,0.06); color: #00274C; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-filled { background: rgba(0,0,0,0.06); color: #6e6e73; border: none; border-radius: 8px; padding: 7px 14px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
        .btn-filled:hover { background: rgba(0,0,0,0.1); }
        [data-theme="dark"] .btn-filled { background: rgba(255,255,255,0.08); color: #8e8e93; }
        [data-theme="dark"] .btn-filled:hover { background: rgba(255,255,255,0.12); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 300; display: flex; align-items: center; justify-content: center; padding: 24px; backdrop-filter: blur(6px); }
        .modal { background: #fff; border-radius: 20px; width: 100%; max-width: 540px; max-height: 88vh; overflow-y: auto; box-shadow: 0 32px 80px rgba(0,0,0,0.18); }
        .stat-card { background: #fff; border-radius: 14px; border: 1px solid rgba(0,0,0,0.07); padding: 20px; }
        .img-thumb { position: relative; border-radius: 10px; overflow: hidden; aspect-ratio: 1; }
        .img-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .img-thumb .rm { position: absolute; top: 5px; right: 5px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; border: none; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; font-family: inherit; }
        .img-thumb:hover .rm { opacity: 1; }
        .drop-zone { border: 2px dashed rgba(0,39,76,0.2); border-radius: 12px; padding: 24px; text-align: center; cursor: pointer; transition: all 0.2s; background: #fafaf8; }
        .drop-zone:hover { border-color: #00274C; background: rgba(0,39,76,0.03); }
        .user-menu-item { width: 100%; padding: 11px 16px; background: none; border: none; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; text-align: left; display: flex; align-items: center; gap: 10px; transition: background 0.15s; color: #1d1d1f; }
        .user-menu-item:hover { background: #f5f5f7; }
        .user-menu-item.danger { color: #ff3b30; }
        .user-menu-item.danger:hover { background: rgba(255,59,48,0.05); }
        .dark-toggle { width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; border: 1.5px solid; }
        .dark-toggle:hover { transform: scale(1.1); }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
        [data-theme="dark"] body { background: #0f0f11; }
        [data-theme="dark"] .field-input { background: #2c2c2e; border-color: rgba(255,255,255,0.1); color: #f5f5f7; }
        [data-theme="dark"] .field-input::placeholder { color: #636366; }
        [data-theme="dark"] .field-input:focus { border-color: #FFCB05; box-shadow: 0 0 0 3px rgba(255,203,5,0.1); }
        [data-theme="dark"] .sidebar-link { color: #8e8e93; }
        [data-theme="dark"] .sidebar-link:hover { background: rgba(255,255,255,0.06); color: #f5f5f7; }
        [data-theme="dark"] .sidebar-link.active { background: rgba(255,203,5,0.1); color: #FFCB05; }
        [data-theme="dark"] .listing-card { background: #1c1c1e; border-color: rgba(255,255,255,0.08); }
        [data-theme="dark"] .listing-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        [data-theme="dark"] .stat-card { background: #1c1c1e; border-color: rgba(255,255,255,0.08); }
        [data-theme="dark"] .modal { background: #1c1c1e; }
        [data-theme="dark"] .user-menu-item { color: #f5f5f7; }
        [data-theme="dark"] .user-menu-item:hover { background: rgba(255,255,255,0.06); }
        [data-theme="dark"] .drop-zone { background: #2c2c2e; border-color: rgba(255,255,255,0.15); }
      `}</style>

      <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, sans-serif', background: dm ? '#0f0f11' : '#f7f7f8' }}>

        {/* SIDEBAR */}
        <div style={{ width: 240, flexShrink: 0, background: dm ? '#1c1c1e' : '#fff', borderRight: `1px solid ${dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, display: 'flex', flexDirection: 'column', padding: '24px 16px', position: 'fixed', top: 0, bottom: 0, left: 0, zIndex: 100 }}>
          <div style={{ marginBottom: 32, padding: '4px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SublyWordmark size={26} onClick={onBack} light={dm} />
            <button className="dark-toggle" onClick={onToggleDark} title={dm ? 'Light mode' : 'Dark mode'} style={{ borderColor: dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', background: dm ? 'rgba(255,255,255,0.08)' : '#f5f5f7' }}>
              {dm ? '☀️' : '🌙'}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: dm ? '#636366' : '#c7c7cc', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 16px', marginBottom: 6 }}>Menu</div>
            {[{ id: 'listings', icon: '🏠', label: 'My Listings' }, { id: 'account', icon: '👤', label: 'Account' }].map(item => (
              <button key={item.id} className={`sidebar-link ${activeTab === item.id ? 'active' : ''}`} onClick={() => setActiveTab(item.id)}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>{item.label}
              </button>
            ))}
            <div style={{ height: 1, background: dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '12px 8px' }} />
            <button className="sidebar-link" onClick={onBrowse}><span style={{ fontSize: 16 }}>🔍</span>Browse Listings</button>
            <button className="sidebar-link" onClick={onPost}><span style={{ fontSize: 16 }}>➕</span>Post a Listing</button>
            <button className="sidebar-link" onClick={onBack}><span style={{ fontSize: 16 }}>←</span>Back to Home</button>
          </div>

          {/* User menu */}
          <div style={{ position: 'relative' }}>
            {showUserMenu && (
              <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, background: dm ? '#2c2c2e' : '#fff', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', border: `1px solid ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, overflow: 'hidden', marginBottom: 8 }}>
                <button className="user-menu-item" onClick={() => { setShowUserMenu(false); setActiveTab('account') }}>👤 Account Settings</button>
                <div style={{ height: 1, background: dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />
                <button className="user-menu-item danger" onClick={async () => { await supabase.auth.signOut(); onBack() }}>🚪 Sign Out</button>
              </div>
            )}
            <div onClick={() => setShowUserMenu(p => !p)} style={{ borderTop: `1px solid ${dm ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderRadius: 10, padding: '12px 8px', transition: 'background 0.15s', background: showUserMenu ? (dm ? 'rgba(255,255,255,0.06)' : 'rgba(0,39,76,0.05)') : 'transparent' }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#00274C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#FFCB05', flexShrink: 0 }}>{initials}</div>
              <div style={{ overflow: 'hidden', flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: dm ? '#f5f5f7' : '#1d1d1f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email?.split('@')[0]}</div>
                <div style={{ fontSize: 11, color: dm ? '#636366' : '#aeaeb2' }}>@umich.edu</div>
              </div>
              <span style={{ fontSize: 10, color: '#aeaeb2' }}>{showUserMenu ? '▲' : '▼'}</span>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, marginLeft: 240, padding: '40px', overflowY: 'auto', minHeight: '100vh', background: dm ? '#0f0f11' : '#f7f7f8' }}>

          {activeTab === 'listings' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontSize: 26, fontWeight: 800, color: dm ? '#f5f5f7' : '#1d1d1f', letterSpacing: '-0.03em', marginBottom: 4 }}>My Listings</h1>
                  <p style={{ fontSize: 14, color: dm ? '#8e8e93' : '#aeaeb2' }}>Manage your subleases in one place.</p>
                </div>
                <button className="btn-primary" onClick={onPost}>+ New Listing</button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 32 }}>
                {[{ label: 'Total Listings', value: listings.length, icon: '🏠' }, { label: 'Active Now', value: listings.length, icon: '✅' }, { label: 'Inquiries', value: '—', icon: '✉️' }].map(s => (
                  <div key={s.label} className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#aeaeb2', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{s.label}</div>
                      <span style={{ fontSize: 18 }}>{s.icon}</span>
                    </div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#00274C', letterSpacing: '-0.03em' }}>{s.value}</div>
                  </div>
                ))}
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: '#aeaeb2' }}>Loading your listings...</div>
              ) : listings.length === 0 ? (
                <div style={{ background: dm ? '#1c1c1e' : '#fff', borderRadius: 16, border: `2px dashed ${dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, padding: '64px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>🏠</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: dm ? '#f5f5f7' : '#1d1d1f', marginBottom: 8 }}>No listings yet</div>
                  <p style={{ fontSize: 14, color: dm ? '#8e8e93' : '#aeaeb2', marginBottom: 24 }}>Post your first sublease and start connecting with UMich students.</p>
                  <button className="btn-primary" onClick={onPost}>Post your first listing</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {listings.map(listing => (
                    <div key={listing.id} className="listing-card">
                      <div style={{ display: 'flex' }}>
                        <div style={{ width: 130, flexShrink: 0, background: '#f5f5f7' }}>
                          {getCoverImage(listing.image_url)
                            ? <img src={getCoverImage(listing.image_url)} alt={listing.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 120 }} />
                            : <div style={{ width: '100%', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🏠</div>
                          }
                        </div>
                        <div style={{ flex: 1, padding: '16px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, color: dm ? '#f5f5f7' : '#1d1d1f' }}>{listing.title}</h3>
                                {listing.filled && <span style={{ fontSize: 11, fontWeight: 600, background: dm ? 'rgba(255,255,255,0.1)' : '#e5e5ea', color: dm ? '#8e8e93' : '#6e6e73', padding: '2px 8px', borderRadius: 980, whiteSpace: 'nowrap' }}>Filled</span>}
                              </div>
                              <span style={{ fontSize: 16, fontWeight: 800, color: dm ? '#FFCB05' : '#00274C' }}>${listing.price}<span style={{ fontSize: 12, fontWeight: 400, color: dm ? '#636366' : '#aeaeb2' }}>/mo</span></span>
                            </div>
                            <p style={{ fontSize: 13, color: dm ? '#8e8e93' : '#aeaeb2', marginBottom: 10 }}>📍 {listing.address}</p>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, background: '#f5f5f7', color: '#6e6e73', padding: '3px 9px', borderRadius: 980 }}>{listing.beds}</span>
                              {listing.dates && <span style={{ fontSize: 11, background: 'rgba(255,203,5,0.12)', color: '#7a5c00', padding: '3px 9px', borderRadius: 980 }}>{listing.dates}</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
                            <button className="btn-filled" onClick={() => handleToggleFilled(listing)}>
                              {listing.filled ? '↩ Mark as Available' : '✓ Mark as Filled'}
                            </button>
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

          {activeTab === 'account' && (
            <div>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, color: dm ? '#f5f5f7' : '#1d1d1f', letterSpacing: '-0.03em', marginBottom: 4 }}>Account</h1>
                <p style={{ fontSize: 14, color: dm ? '#8e8e93' : '#aeaeb2' }}>Your profile and verification details.</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 560 }}>
                <div className="stat-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#00274C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#FFCB05' }}>{initials}</div>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#1d1d1f' }}>{user?.email?.split('@')[0]}</div>
                      <div style={{ fontSize: 13, color: '#aeaeb2' }}>{user?.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[{ label: 'Email', value: user?.email }, { label: 'Verification', value: '✓ UMich student verified' }, { label: 'Listings posted', value: listings.length }].map(row => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <span style={{ fontSize: 13, color: '#aeaeb2' }}>{row.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: row.label === 'Verification' ? '#34c759' : '#1d1d1f' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="stat-card" style={{ background: 'rgba(255,59,48,0.04)', border: '1px solid rgba(255,59,48,0.1)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#ff3b30', marginBottom: 6 }}>Sign out</div>
                  <p style={{ fontSize: 13, color: '#aeaeb2', marginBottom: 16 }}>You will need to sign in again with your UMich email.</p>
                  <button onClick={async () => { await supabase.auth.signOut(); onBack() }} style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Sign out</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EDIT MODAL */}
      {editingListing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditingListing(null)}>
          <div className="modal">
            <div style={{ padding: '24px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: dm ? '#f5f5f7' : '#1d1d1f', letterSpacing: '-0.02em' }}>Edit Listing</h2>
              <button onClick={() => setEditingListing(null)} style={{ background: 'none', border: 'none', fontSize: 22, color: '#aeaeb2', cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Image editor */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#6e6e73', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Photos</label>
                  <span style={{ fontSize: 11, color: totalImages >= 5 ? '#ff3b30' : '#aeaeb2' }}>{totalImages} / 5</span>
                </div>

                {totalImages > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 10 }}>
                    {editImages.map((url, i) => (
                      <div key={`ex-${i}`} className="img-thumb">
                        <img src={url} alt="" />
                        {i === 0 && <div style={{ position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 980, fontWeight: 600 }}>Cover</div>}
                        <button className="rm" onClick={() => removeExistingImage(i)}>×</button>
                      </div>
                    ))}
                    {newImages.map((img, i) => (
                      <div key={`new-${i}`} className="img-thumb">
                        <img src={img.preview} alt="" />
                        <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,113,227,0.8)', color: '#fff', fontSize: 9, padding: '2px 6px', borderRadius: 980 }}>New</div>
                        <button className="rm" onClick={() => removeNewImage(i)}>×</button>
                      </div>
                    ))}
                  </div>
                )}

                {totalImages < 5 && (
                  <div className="drop-zone" onClick={() => document.getElementById('edit-img-input').click()}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#00274C', marginBottom: 2 }}>{totalImages === 0 ? 'Add photos' : 'Add more'}</div>
                    <div style={{ fontSize: 11, color: '#aeaeb2' }}>Click to browse</div>
                  </div>
                )}
                <input id="edit-img-input" type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => handleNewImages(e.target.files)} />
              </div>

              {[
                { label: 'Title', field: 'title', placeholder: 'Studio near Central Campus' },
                { label: 'Address', field: 'address', placeholder: '523 E William St, Ann Arbor' },
                { label: 'Available Dates', field: 'dates', placeholder: 'May 1 to Aug 15' },
                { label: 'Contact Email', field: 'contact_email', placeholder: 'you@umich.edu' },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</label>
                  <input className="field-input" placeholder={placeholder} value={editForm[field]} onChange={e => updateEdit(field, e.target.value)} />
                </div>
              ))}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Monthly Rent</label>
                  <input className="field-input" type="number" value={editForm.price} onChange={e => updateEdit('price', e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Bedrooms</label>
                  <select className="field-input" value={editForm.beds} onChange={e => updateEdit('beds', e.target.value)}>
                    {['Studio', '1 Bed', '2 Bed', '3 Bed', '4+ Bed'].map(b => <option key={b}>{b}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6e6e73', marginBottom: 6, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description</label>
                <textarea className="field-input" rows={3} value={editForm.description} onChange={e => updateEdit('description', e.target.value)} style={{ resize: 'vertical' }} />
              </div>

              <button onClick={handleSave} disabled={saveStatus === 'loading'} style={{ width: '100%', background: saveStatus === 'success' ? '#34c759' : '#00274C', color: saveStatus === 'success' ? '#fff' : '#FFCB05', border: 'none', borderRadius: 10, padding: '13px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                {saveStatus === 'loading' ? 'Saving...' : saveStatus === 'success' ? '✓ Saved!' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {confirmDelete && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 44, marginBottom: 16 }}>🗑️</div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: dm ? '#f5f5f7' : '#1d1d1f', marginBottom: 8 }}>Delete this listing?</h2>
              <p style={{ fontSize: 14, color: dm ? '#8e8e93' : '#6e6e73', marginBottom: 28, lineHeight: 1.6 }}><strong>{confirmDelete.title}</strong> will be permanently removed.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: dm ? '#2c2c2e' : '#f5f5f7', color: dm ? '#f5f5f7' : '#1d1d1f', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                <button onClick={() => handleDelete(confirmDelete.id)} disabled={deletingId === confirmDelete.id} style={{ flex: 1, background: '#ff3b30', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: deletingId === confirmDelete.id ? 0.6 : 1 }}>
                  {deletingId === confirmDelete.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
