import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'
import Auth from './Auth'
import PostListing from './PostListing'
import BrowseListings from './BrowseListings'
import Dashboard from './Dashboard'
import { SublyLogo, SublyWordmark } from './Logo'

const LISTINGS = [
  { id: 1, title: 'Studio near Central Campus', price: 875, dates: 'May 1 to Aug 15', location: 'E William St', beds: 'Studio', walk: '6 min walk' },
  { id: 2, title: '1BR South Quad Area', price: 1100, dates: 'Jun 1 to Aug 31', location: 'Greene St', beds: '1 Bed', walk: '3 min walk' },
  { id: 3, title: '2BR Kerrytown Apartment', price: 1450, dates: 'Jul 15 to Dec 15', location: 'N Fourth Ave', beds: '2 Bed', walk: '12 min walk' },
]

const COLORS = ['#dbeafe', '#dcfce7', '#fef9c3']
const COLORS_DARK = ['#1e2a3a', '#1a2a1e', '#2a2610']

// Static CSS injected once — dark mode handled entirely via [data-theme] attribute + CSS variables
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }

  :root {
    --bg: #fff;
    --bg2: #f5f5f7;
    --card: #fff;
    --text: #1d1d1f;
    --sub: #6e6e73;
    --faint: #aeaeb2;
    --border: rgba(0,0,0,0.07);
    --border-soft: rgba(0,0,0,0.06);
    --hero-grad: linear-gradient(160deg, #f0f4ff 0%, #fff 50%, #fffdf0 100%);
    --shadow: rgba(0,39,76,0.14);
    --card-shadow: rgba(0,0,0,0.04);
    --nav-blur-bg: rgba(255,255,255,0.9);
    --outline-color: #00274C;
    --outline-border: rgba(0,39,76,0.2);
    --outline-hover-bg: rgba(0,39,76,0.04);
    --pill-bg: #f5f5f7;
    --pill-gold-color: #7a5c00;
    --card-hover-shadow: rgba(0,39,76,0.13);
  }
  [data-theme="dark"] {
    --bg: #0f0f11;
    --bg2: #141416;
    --card: #1c1c1e;
    --text: #f5f5f7;
    --sub: #8e8e93;
    --faint: #636366;
    --border: rgba(255,255,255,0.08);
    --border-soft: rgba(255,255,255,0.06);
    --hero-grad: linear-gradient(160deg, #0f0f18 0%, #0f0f11 50%, #0f0e0f 100%);
    --shadow: rgba(0,0,0,0.5);
    --card-shadow: rgba(0,0,0,0.2);
    --nav-blur-bg: rgba(15,15,17,0.92);
    --outline-color: #FFCB05;
    --outline-border: rgba(255,203,5,0.35);
    --outline-hover-bg: rgba(255,203,5,0.08);
    --pill-bg: #2c2c2e;
    --pill-gold-color: #FFCB05;
    --card-hover-shadow: rgba(0,0,0,0.4);
  }

  body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; overflow-x: hidden; }
  a { text-decoration: none; color: inherit; }
  button { font-family: inherit; cursor: pointer; border: none; background: none; }

  @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-10px); } }
  @keyframes pulse-dot { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.85); } }

  .nav-link { color: var(--sub); font-size: 14px; transition: color 0.2s; }
  .nav-link:hover { color: var(--text); }

  .btn-blue { background: #00274C; color: #FFCB05; border-radius: 980px; padding: 11px 24px; font-size: 14px; font-weight: 600; transition: all 0.25s; display: inline-flex; align-items: center; gap: 6px; }
  .btn-blue:hover { background: #003a6e; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,39,76,0.28); }
  .btn-blue:active { transform: scale(0.97); }

  .btn-maize { background: #FFCB05; color: #00274C; border-radius: 980px; padding: 11px 24px; font-size: 14px; font-weight: 700; transition: all 0.25s; }
  .btn-maize:hover { background: #ffe033; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,203,5,0.4); }
  .btn-maize:active { transform: scale(0.97); }

  .btn-outline { background: transparent; color: var(--outline-color); border: 1.5px solid var(--outline-border); border-radius: 980px; padding: 10px 22px; font-size: 14px; font-weight: 500; transition: all 0.2s; }
  .btn-outline:hover { border-color: var(--outline-color); background: var(--outline-hover-bg); }

  .card-hover { transition: all 0.3s ease; }
  .card-hover:hover { box-shadow: 0 16px 48px var(--card-hover-shadow); transform: translateY(-4px); }

  .pill { font-size: 12px; color: var(--sub); background: var(--pill-bg); padding: 4px 11px; border-radius: 980px; }
  .pill-gold { background: rgba(255,203,5,0.15); color: var(--pill-gold-color); font-weight: 500; }
  .pill-green { background: rgba(52,199,89,0.1); color: #1a8c39; font-weight: 500; }

  .footer-link { color: rgba(255,255,255,0.4); font-size: 13px; transition: color 0.2s; }
  .footer-link:hover { color: rgba(255,255,255,0.85); }

  .section-fade { opacity: 0; transform: translateY(48px) scale(0.97); transition: opacity 0.8s cubic-bezier(0.4,0,0.2,1), transform 0.8s cubic-bezier(0.4,0,0.2,1); }
  .section-fade.visible { opacity: 1; transform: translateY(0) scale(1); }
  .stagger-1 { transition-delay: 0.12s !important; }
  .stagger-2 { transition-delay: 0.26s !important; }
  .stagger-3 { transition-delay: 0.40s !important; }

  .float-card { animation: float 5s ease-in-out infinite; }

  .dark-toggle { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--border); background: var(--bg2); cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s; color: var(--text); }
  .dark-toggle:hover { transform: scale(1.1); }

  .lp-card { background: var(--card); border-radius: 20px; border: 1px solid var(--border); box-shadow: 0 2px 8px var(--card-shadow); }
  .lp-text { color: var(--text); }
  .lp-sub { color: var(--sub); }
  .lp-faint { color: var(--faint); }
  .lp-bg { background: var(--bg); }
  .lp-bg2 { background: var(--bg2); }
  .lp-border { border-color: var(--border); }
  .step-card { border-radius: 20px; padding: 40px 32px; border: 1.5px solid var(--border); text-align: center; transition: all 0.4s ease; background: var(--card); }
  .step-card.active { border-color: #FFCB05 !important; background: var(--bg2) !important; box-shadow: 0 8px 32px var(--card-shadow); }

  @media (max-width: 900px) {
    .hero-inner { flex-direction: column !important; }
    .hero-card-col { width: 100% !important; margin-top: 48px; }
    .grid-3 { grid-template-columns: 1fr 1fr !important; }
    .nav-center { display: none !important; }
    .preview-grid { grid-template-columns: 1fr !important; }
    .hero-h1 { font-size: 52px !important; }
  }
  @media (max-width: 390px) {
    .hero-h1 { font-size: 40px !important; letter-spacing: -0.03em !important; }
    .hero-card-col { display: none !important; }
    .hero-mobile-cta { display: flex !important; }
    .nav-desktop-mid { display: none !important; }
    .nav-desktop-auth { display: none !important; }
    .hamburger-btn { display: flex !important; }
    .grid-3 { grid-template-columns: 1fr !important; }
    .preview-grid { grid-template-columns: 1fr !important; }
    .footer-top { flex-direction: column !important; align-items: flex-start !important; }
    .cta-h2 { font-size: 40px !important; }
    .mobile-menu { display: flex !important; }
  }
`

export default function App() {
  const [showAuth, setShowAuth] = useState(false)
  const [showPost, setShowPost] = useState(false)
  const [showBrowse, setShowBrowse] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authMode, setAuthMode] = useState('signup')
  const [newListingForModal, setNewListingForModal] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [activeCard, setActiveCard] = useState(0)
  const [visibleSections, setVisibleSections] = useState(new Set())
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('subly_dark') === 'true')
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const avatarRef = useRef(null)

  const toggleDark = () => setDarkMode(d => {
    const n = !d
    localStorage.setItem('subly_dark', String(n))
    document.documentElement.dataset.theme = n ? 'dark' : 'light'
    return n
  })

  // Set data-theme on mount and keep in sync
  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
  }, [darkMode])

  useEffect(() => {
    setMounted(true)
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'

    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setCurrentUser(session.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user || null)
    })

    const t1 = setInterval(() => setActiveStep(s => (s + 1) % 3), 2800)
    const t2 = setInterval(() => setActiveCard(s => (s + 1) % LISTINGS.length), 3200)

    const obs = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) setVisibleSections(prev => new Set([...prev, e.target.dataset.section]))
      }),
      { threshold: 0.12 }
    )
    document.querySelectorAll('[data-section]').forEach(el => obs.observe(el))

    const onClickOutside = (e) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setShowAvatarMenu(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)

    return () => {
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mousedown', onClickOutside)
      clearInterval(t1)
      clearInterval(t2)
      obs.disconnect()
      subscription.unsubscribe()
    }
  }, [])

  const vis = id => visibleSections.has(id)

  if (showAuth) return <Auth onBack={() => setShowAuth(false)} onLogin={user => { setCurrentUser(user); setShowAuth(false); setShowDashboard(true) }} initialMode={authMode} darkMode={darkMode} onToggleDark={toggleDark} />
  if (showPost) return <PostListing onBack={() => setShowPost(false)} user={currentUser} onSuccess={(listing) => { setShowPost(false); setNewListingForModal(listing); setShowBrowse(true) }} darkMode={darkMode} onToggleDark={toggleDark} />
  if (showBrowse) return <BrowseListings onBack={() => setShowBrowse(false)} onPost={() => { setShowBrowse(false); setShowPost(true) }} onDashboard={() => { setShowBrowse(false); setShowDashboard(true) }} currentUser={currentUser} initialModal={newListingForModal} onModalClear={() => setNewListingForModal(null)} darkMode={darkMode} onToggleDark={toggleDark} onSignIn={() => { setShowBrowse(false); setAuthMode('signin'); setShowAuth(true) }} />
  if (showDashboard) return <Dashboard user={currentUser} onBack={() => setShowDashboard(false)} onPost={() => { setShowDashboard(false); setShowPost(true) }} onBrowse={() => { setShowDashboard(false); setShowBrowse(true) }} darkMode={darkMode} onToggleDark={toggleDark} />

  const listing = LISTINGS[activeCard]
  const colors = darkMode ? COLORS_DARK : COLORS

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: scrolled ? 'var(--nav-blur-bg)' : 'transparent',
        backdropFilter: scrolled ? 'saturate(180%) blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'all 0.3s ease',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <SublyWordmark size={28} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} light={darkMode} />

          {/* Center nav items */}
          {currentUser ? (
            <div className="nav-desktop-mid" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => setShowBrowse(true)} style={{ background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 980, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#003a6e'}
                onMouseLeave={e => e.currentTarget.style.background = '#00274C'}>
                Browse
              </button>
              <button onClick={() => setShowPost(true)} style={{ background: '#FFCB05', color: '#00274C', border: 'none', borderRadius: 980, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#ffe033'}
                onMouseLeave={e => e.currentTarget.style.background = '#FFCB05'}>
                Post a Listing
              </button>
            </div>
          ) : (
            <div className="nav-center" style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
              <button onClick={() => setShowBrowse(true)} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Browse</button>
              <a href="#how" className="nav-link">How it Works</a>
              <button onClick={() => { setAuthMode('signup'); setShowAuth(true) }} className="nav-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Post a Listing</button>
            </div>
          )}

          {/* Right controls */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {currentUser ? (
              <div ref={avatarRef} style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  onClick={() => setShowAvatarMenu(m => !m)}
                  style={{ width: 36, height: 36, borderRadius: '50%', background: '#00274C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#FFCB05', cursor: 'pointer', boxShadow: showAvatarMenu ? '0 0 0 3px rgba(0,39,76,0.2)' : '0 2px 8px rgba(0,39,76,0.25)', transition: 'box-shadow 0.15s', userSelect: 'none' }}>
                  {(() => { const u = currentUser.email?.split('@')[0] || ''; return (u[0] + (u[u.length - 1] || '')).toUpperCase() })()}
                </div>
                {showAvatarMenu && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 10px)', left: '50%', transform: 'translateX(-50%)', background: 'var(--card)', borderRadius: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)', border: '1px solid var(--border)', overflow: 'hidden', minWidth: 200, zIndex: 300 }}>
                    <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border-soft)' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{currentUser.email?.split('@')[0]}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)' }}>{currentUser.email}</div>
                    </div>
                    {[
                      { label: 'View Dashboard', icon: '🏠', action: () => { setShowAvatarMenu(false); setShowDashboard(true) } },
                      { label: 'Post a Listing', icon: '➕', action: () => { setShowAvatarMenu(false); setShowPost(true) } },
                    ].map(item => (
                      <button key={item.label} onClick={item.action} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                        <span style={{ fontSize: 15 }}>{item.icon}</span>{item.label}
                      </button>
                    ))}
                    <div style={{ height: 1, background: 'var(--border-soft)' }} />
                    <button onClick={toggleDark} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 14, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 15 }}>{darkMode ? '☀️' : '🌙'}</span>{darkMode ? 'Light Mode' : 'Dark Mode'}
                      </div>
                      <div style={{ width: 32, height: 18, borderRadius: 9, background: darkMode ? '#FFCB05' : '#d2d2d7', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                        <div style={{ position: 'absolute', top: 2, left: darkMode ? 14 : 2, width: 14, height: 14, borderRadius: '50%', background: darkMode ? '#00274C' : '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </div>
                    </button>
                    <div style={{ height: 1, background: 'var(--border-soft)' }} />
                    <button onClick={async () => { setShowAvatarMenu(false); await supabase.auth.signOut(); setCurrentUser(null) }} style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 500, color: '#ff3b30', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,59,48,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ fontSize: 15 }}>🚪</span>Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="nav-desktop-auth" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn-outline" onClick={() => { setAuthMode('signin'); setShowAuth(true) }} style={{ padding: '9px 20px', fontSize: 13 }}>Sign In</button>
                <button className="btn-blue" onClick={() => { setAuthMode('signup'); setShowAuth(true) }} style={{ padding: '9px 20px', fontSize: 13 }}>Sign Up</button>
                <button className="dark-toggle" onClick={toggleDark} title={darkMode ? 'Light mode' : 'Dark mode'}>
                  {darkMode ? '☀️' : '🌙'}
                </button>
              </div>
            )}
            <button
              className="hamburger-btn"
              onClick={() => setShowMobileMenu(m => !m)}
              style={{ display: 'none', flexDirection: 'column', gap: 5, padding: '6px', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              <div style={{ width: 20, height: 2, background: 'var(--text)', borderRadius: 2 }} />
              <div style={{ width: 20, height: 2, background: 'var(--text)', borderRadius: 2 }} />
              <div style={{ width: 14, height: 2, background: 'var(--text)', borderRadius: 2 }} />
            </button>
          </div>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {showMobileMenu && (
        <div className="mobile-menu" style={{
          display: 'none', position: 'fixed', top: 58, left: 0, right: 0, zIndex: 199,
          background: 'var(--card)', borderBottom: '1px solid var(--border)',
          flexDirection: 'column', gap: 4, padding: '12px 16px 20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
        }}>
          <button onClick={() => { setShowBrowse(true); setShowMobileMenu(false) }} style={{ background: 'none', border: 'none', textAlign: 'left', padding: '12px 8px', fontSize: 15, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 8 }}>Browse Listings</button>
          <a href="#how" onClick={() => setShowMobileMenu(false)} style={{ display: 'block', padding: '12px 8px', fontSize: 15, fontWeight: 500, color: 'var(--text)', textDecoration: 'none', borderRadius: 8 }}>How it Works</a>
          {!currentUser && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <button onClick={() => { setAuthMode('signin'); setShowAuth(true); setShowMobileMenu(false) }} style={{ background: 'none', border: 'none', textAlign: 'left', padding: '12px 8px', fontSize: 15, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 8 }}>Sign In</button>
              <button onClick={() => { setAuthMode('signup'); setShowAuth(true); setShowMobileMenu(false) }} style={{ background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 10, padding: '13px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>Create Account</button>
            </>
          )}
          {currentUser && (
            <>
              <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />
              <button onClick={() => { setShowPost(true); setShowMobileMenu(false) }} style={{ background: '#00274C', color: '#FFCB05', border: 'none', borderRadius: 10, padding: '13px 16px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Post a Listing</button>
              <button onClick={() => { setShowDashboard(true); setShowMobileMenu(false) }} style={{ background: 'none', border: 'none', textAlign: 'left', padding: '12px 8px', fontSize: 15, fontWeight: 500, color: 'var(--text)', cursor: 'pointer', fontFamily: 'inherit' }}>My Dashboard</button>
            </>
          )}
        </div>
      )}

      {/* HERO */}
      <section style={{ background: 'var(--hero-grad)', paddingTop: 58, minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)', width: '100%' }}>
          <div className="hero-inner" style={{ display: 'flex', alignItems: 'center', gap: 72 }}>
            <div style={{ flex: 1, opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(28px)', transition: 'all 0.9s cubic-bezier(0.4,0,0.2,1)' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: darkMode ? 'rgba(255,255,255,0.07)' : 'rgba(0,39,76,0.07)', borderRadius: 980, padding: '6px 16px', marginBottom: 32 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34c759', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: darkMode ? '#a0c4f1' : '#00274C' }}>For University of Michigan students</span>
              </div>

              <h1 className="hero-h1" style={{ fontSize: 70, fontWeight: 900, lineHeight: 1.04, letterSpacing: '-0.04em', color: darkMode ? '#f5f5f7' : '#00274C', marginBottom: 28 }}>
                Find your sublease<br />
                <span style={{ background: 'linear-gradient(135deg, #FFCB05 0%, #f0a500 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block' }}>
                  without the chaos.
                </span>
              </h1>

              <p style={{ fontSize: 19, lineHeight: 1.65, color: 'var(--sub)', marginBottom: 40, maxWidth: 460, fontWeight: 400 }}>
                No more Facebook groups. No more scams. Just verified UMich student listings with smart filters and direct messaging.
              </p>

              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 56 }}>
                <button className="btn-blue" onClick={() => setShowBrowse(true)} style={{ padding: '13px 28px', fontSize: 15 }}>Browse Listings</button>
                <button className="btn-outline" onClick={() => currentUser ? setShowPost(true) : (() => { setAuthMode('signup'); setShowAuth(true) })()}>Post Your Place</button>
              </div>

              <div className="hero-mobile-cta" style={{ display: 'none', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
                <button className="btn-blue" onClick={() => setShowBrowse(true)} style={{ padding: '15px 28px', fontSize: 15, justifyContent: 'center', width: '100%' }}>Browse Listings</button>
                <button className="btn-outline" onClick={() => currentUser ? setShowPost(true) : (() => { setAuthMode('signup'); setShowAuth(true) })()} style={{ padding: '14px 28px', textAlign: 'center', width: '100%' }}>Post Your Place</button>
              </div>

              <div style={{ display: 'flex', gap: 0, borderTop: '1px solid var(--border)', paddingTop: 32 }}>
                {[['100%', 'UMich verified'], ['$0', 'Zero fees'], ['2 min', 'To post']].map(([v, l], i) => (
                  <div key={l} style={{ flex: 1, paddingRight: 24, borderRight: i < 2 ? '1px solid var(--border)' : 'none', paddingLeft: i > 0 ? 24 : 0 }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: darkMode ? '#FFCB05' : '#00274C', letterSpacing: '-0.03em' }}>{v}</div>
                    <div style={{ fontSize: 13, color: 'var(--faint)', marginTop: 3 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Floating card */}
            <div className="hero-card-col float-card" style={{ width: 360, flexShrink: 0, opacity: mounted ? 1 : 0, transition: 'opacity 1s ease 0.3s' }}>
              <div style={{ background: 'var(--card)', borderRadius: 24, border: '1.5px solid var(--border)', boxShadow: `0 40px 100px var(--shadow)`, overflow: 'hidden' }}>
                <div style={{ background: '#00274C', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#FFCB05', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Live listings</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Ann Arbor, MI</span>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ height: 120, borderRadius: 12, background: colors[activeCard], marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, transition: 'background 0.5s ease' }}>🏠</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{listing.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--faint)' }}>{listing.location}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: darkMode ? '#FFCB05' : '#00274C' }}>${listing.price}</span>
                      <span style={{ fontSize: 12, color: 'var(--faint)' }}>/mo</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                    <span className="pill">{listing.beds}</span>
                    <span className="pill">{listing.walk}</span>
                    <span className="pill pill-gold">{listing.dates}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    <span className="pill pill-green">✓ UMich verified</span>
                    <button onClick={() => setShowBrowse(true)} style={{ fontSize: 13, color: darkMode ? '#FFCB05' : '#00274C', fontWeight: 600 }}>View listing</button>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 7, paddingBottom: 18 }}>
                  {LISTINGS.map((_, i) => (
                    <button key={i} style={{ width: i === activeCard ? 22 : 7, height: 7, borderRadius: 980, background: i === activeCard ? '#00274C' : 'var(--faint)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s' }} onClick={() => setActiveCard(i)} />
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'var(--faint)' }}>40+ active listings this semester</div>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <div style={{ background: '#00274C', padding: '20px clamp(20px, 4vw, 48px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'center', gap: 56, flexWrap: 'wrap' }}>
          {['@umich.edu verified only', 'No listing fees ever', 'Student-to-student only', 'Direct messaging'].map((item) => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#FFCB05', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#00274C', flexShrink: 0 }}>✓</div>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PROBLEM */}
      <section id="browse" style={{ background: 'var(--bg2)', padding: '110px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)' }}>
          <div data-section="problem" className={`section-fade ${vis('problem') ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFCB05', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, background: '#00274C', display: 'inline-block', padding: '5px 16px', borderRadius: 980 }}>The Problem</div>
            <h2 style={{ fontSize: 50, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Students are tired of this.</h2>
          </div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { icon: '😤', title: 'Messy Facebook groups', desc: 'Hundreds of posts with zero organization. You miss a listing the moment it goes up and there is no way to filter what you need.' },
              { icon: '🚨', title: 'Scams and fake listings', desc: 'No verification, no accountability. Anyone can post anything. Students lose money every semester to fake subleases.' },
              { icon: '♾️', title: 'Endless scrolling', desc: 'No filters, no search, no dates. Finding a sublease that fits your timeline means hours of mindless manual scrolling.' },
            ].map((p, i) => (
              <div key={p.title} data-section={`prob${i}`} className={`lp-card card-hover section-fade stagger-${i + 1} ${vis(`prob${i}`) ? 'visible' : ''}`} style={{ padding: '36px 32px' }}>
                <div style={{ fontSize: 44, marginBottom: 20 }}>{p.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.01em' }}>{p.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--sub)', lineHeight: 1.65 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUTION */}
      <section style={{ background: 'var(--bg)', padding: '110px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)' }}>
          <div data-section="solution" className={`section-fade ${vis('solution') ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFCB05', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, background: '#00274C', display: 'inline-block', padding: '5px 16px', borderRadius: 980 }}>The Solution</div>
            <h2 style={{ fontSize: 50, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>A better way to sublease.</h2>
            <p style={{ fontSize: 17, color: 'var(--sub)', marginTop: 16, maxWidth: 500, margin: '16px auto 0' }}>Built from scratch for Wolverines, by Wolverines.</p>
          </div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
            {[
              { icon: '🎓', bg: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,39,76,0.07)', title: 'Verified students only', desc: 'Every account requires a @umich.edu email. No exceptions. No anonymous posters. Just real Wolverines.' },
              { icon: '🔍', bg: 'rgba(255,203,5,0.15)', title: 'Smart filters', desc: 'Filter by exact dates, price range, bedrooms, and distance to campus. Find exactly what fits.' },
              { icon: '⚡', bg: 'rgba(52,199,89,0.12)', title: 'Instant matches', desc: 'Get notified the moment a listing matches your criteria. No more refreshing Facebook groups every day.' },
            ].map((f, i) => (
              <div key={f.title} data-section={`feat${i}`} className={`lp-card card-hover section-fade stagger-${i + 1} ${vis(`feat${i}`) ? 'visible' : ''}`} style={{ padding: '36px 32px' }}>
                <div style={{ width: 54, height: 54, borderRadius: 14, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 24 }}>{f.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.01em' }}>{f.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--sub)', lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRODUCT PREVIEW */}
      <section style={{ background: 'var(--bg2)', padding: '110px 0' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)', textAlign: 'center' }}>
          <div data-section="preview" className={`section-fade ${vis('preview') ? 'visible' : ''}`}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFCB05', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, background: '#00274C', display: 'inline-block', padding: '5px 16px', borderRadius: 980 }}>Preview</div>
            <h2 style={{ fontSize: 50, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', marginBottom: 12, lineHeight: 1.1 }}>See it in action.</h2>
            <p style={{ fontSize: 17, color: 'var(--sub)', marginBottom: 56 }}>Clean, fast, and exactly what you need.</p>
          </div>
          <div data-section="mockup" className={`section-fade ${vis('mockup') ? 'visible' : ''}`} style={{ background: 'var(--card)', borderRadius: 20, padding: 8, boxShadow: `0 40px 100px var(--shadow)`, border: '1px solid var(--border)' }}>
            <div style={{ background: 'var(--bg2)', borderRadius: 13, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['#ff5f57', '#febc2e', '#28c840'].map(c => <div key={c} style={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}
                </div>
                <div style={{ flex: 1, background: 'var(--card)', borderRadius: 7, padding: '5px 12px', fontSize: 12, color: 'var(--faint)', textAlign: 'center', border: '1px solid var(--border)' }}>subly.app/browse</div>
              </div>
              <div style={{ padding: '20px 24px' }}>
                <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <span style={{ fontSize: 14, color: 'var(--faint)' }}>🔍</span>
                  <span style={{ fontSize: 13, color: 'var(--faint)' }}>Search by dates, price, or neighborhood...</span>
                  <button className="btn-blue" style={{ marginLeft: 'auto', padding: '6px 14px', fontSize: 12 }}>Search</button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                  {['May to August', 'Under $1,200', 'Studio / 1BR', 'Near Central Campus'].map((f, i) => (
                    <div key={f} style={{ fontSize: 12, padding: '5px 12px', borderRadius: 980, background: i === 0 ? '#00274C' : 'var(--card)', color: i === 0 ? '#FFCB05' : 'var(--sub)', border: `1px solid ${i === 0 ? '#00274C' : 'var(--border)'}`, fontWeight: i === 0 ? 600 : 400 }}>{f}</div>
                  ))}
                </div>
                <div className="preview-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  {LISTINGS.map((l, i) => (
                    <div key={l.id} className="card-hover lp-card" style={{ padding: 16 }}>
                      <div style={{ height: 80, borderRadius: 8, background: colors[i], marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🏠</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{l.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 8 }}>{l.dates}</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: darkMode ? '#FFCB05' : '#00274C' }}>${l.price}/mo</span>
                        <span style={{ fontSize: 11, color: '#34c759', fontWeight: 600 }}>✓ Verified</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ background: 'var(--bg)', padding: '110px 0' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 clamp(20px, 4vw, 48px)' }}>
          <div data-section="how" className={`section-fade ${vis('how') ? 'visible' : ''}`} style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#FFCB05', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 14, background: '#00274C', display: 'inline-block', padding: '5px 16px', borderRadius: 980 }}>How It Works</div>
            <h2 style={{ fontSize: 50, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>Three steps. That is it.</h2>
          </div>
          <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 32 }}>
            {[
              { n: '01', icon: '🎓', title: 'Register with your UMich email', desc: 'Sign up with your @umich.edu address. Every user is a verified Wolverine. No exceptions, no anonymous posters.' },
              { n: '02', icon: '🏠', title: 'Find your match', desc: 'Browse verified listings filtered by price, dates, bedrooms, and distance to campus. Every listing is from a real UMich student.' },
              { n: '03', icon: '✉️', title: 'Message and secure', desc: 'Contact the lister directly through the platform. No fees, no middlemen. Just two Wolverines working it out.' },
            ].map((step, i) => (
              <div key={step.n} data-section={`step${i}`} className={`step-card section-fade stagger-${i + 1} ${vis(`step${i}`) ? 'visible' : ''} ${activeStep === i ? 'active' : ''}`}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--faint)', letterSpacing: '0.06em', marginBottom: 20 }}>{step.n}</div>
                <div style={{ fontSize: 44, marginBottom: 20 }}>{step.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 12, letterSpacing: '-0.01em' }}>{step.title}</h3>
                <p style={{ fontSize: 15, color: 'var(--sub)', lineHeight: 1.65 }}>{step.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
            {[0, 1, 2].map(i => (
              <button key={i} onClick={() => setActiveStep(i)} style={{ width: i === activeStep ? 22 : 7, height: 7, borderRadius: 980, background: i === activeStep ? '#00274C' : 'var(--faint)', border: 'none', cursor: 'pointer', padding: 0, transition: 'all 0.3s' }} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: '#00274C', padding: 'clamp(64px, 10vw, 130px) clamp(20px, 4vw, 48px)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: '#FFCB05' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,203,5,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div data-section="cta" className={`section-fade ${vis('cta') ? 'visible' : ''}`} style={{ maxWidth: 640, margin: '0 auto', position: 'relative' }}>
          <h2 className="cta-h2" style={{ fontSize: 68, fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 20 }}>
            Stop scrolling.<br />
            <span style={{ color: '#FFCB05' }}>Start finding.</span>
          </h2>
          <p style={{ fontSize: 19, color: 'rgba(255,255,255,0.5)', marginBottom: 48, lineHeight: 1.6 }}>
            Join UMich students who are done with Facebook groups.
          </p>
          <button className="btn-maize" onClick={() => { setAuthMode('signup'); setShowAuth(true) }} style={{ padding: '16px 44px', fontSize: 16 }}>
            Get Started. It Is Free.
          </button>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 20 }}>@umich.edu email required. No credit card.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#00274C', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '40px clamp(20px, 4vw, 48px)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="footer-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20, marginBottom: 28 }}>
            <SublyWordmark size={28} light />
            <div style={{ display: 'flex', gap: 28 }}>
              {['Privacy', 'Terms', 'Contact', 'Instagram'].map(l => (
                <a key={l} href="#" className="footer-link">{l}</a>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {['𝕏', 'ig', 'in'].map(s => (
                <div key={s} style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}>{s}</div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, textAlign: 'center' }}>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.01em' }}>
              Made for Wolverines by Wolverines. Go Blue. 〽️
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
