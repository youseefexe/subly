import { useEffect, useState } from 'react'

export default function ListingModal({ listing, onClose, darkMode }) {
  const dm = darkMode
  const [visible, setVisible] = useState(false)
  const [imgIndex, setImgIndex] = useState(0)
  const [lightbox, setLightbox] = useState(false)

  const parseImages = (raw) => {
    if (!raw) return []
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p : [raw] } catch { return [raw] }
  }
  const images = parseImages(listing.image_url)
  const tags = Array.isArray(listing.tags) ? listing.tags : []

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const onKey = e => {
      if (e.key === 'Escape') { if (lightbox) setLightbox(false); else handleClose() }
      if (e.key === 'ArrowRight') setImgIndex(i => Math.min(i + 1, images.length - 1))
      if (e.key === 'ArrowLeft') setImgIndex(i => Math.max(i - 1, 0))
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [lightbox])

  const handleClose = () => { setVisible(false); setTimeout(onClose, 300) }
  const prev = () => setImgIndex(i => Math.max(i - 1, 0))
  const next = () => setImgIndex(i => Math.min(i + 1, images.length - 1))

  const bg = dm ? '#161618' : '#ffffff'
  const panelBg = dm ? '#1c1c1e' : '#ffffff'
  const textPrimary = dm ? '#f5f5f7' : '#111111'
  const textSub = dm ? '#8e8e93' : '#6e6e73'
  const textFaint = dm ? '#636366' : '#aeaeb2'
  const border = dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const tagBg = dm ? 'rgba(255,255,255,0.05)' : '#f7f7f8'
  const tagBorder = dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'

  const TAG_ICONS = {
    'WiFi': '📶', 'Parking': '🅿️', 'Laundry': '🫧', 'AC': '❄️',
    'Furnished': '🛋️', 'Utilities Included': '💡', 'Pet Friendly': '🐾',
    'Gym': '🏋️', 'Dishwasher': '🍽️', 'Balcony': '🌇', 'Private Room': '🔒',
    'Quiet Building': '🤫',
  }

  return (
    <>
      <style>{`
        @keyframes lm-in { from { opacity: 0; transform: scale(0.97) translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes overlay-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lightbox-in { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: none; } }

        .lm-modal { animation: lm-in 0.28s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
        .lm-overlay { animation: overlay-fade 0.18s ease forwards; }

        .lm-arrow {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(255,255,255,0.92); backdrop-filter: blur(8px);
          border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; color: #111; line-height: 1;
          box-shadow: 0 2px 20px rgba(0,0,0,0.22);
          transition: all 0.15s; z-index: 10;
        }
        .lm-arrow:hover { background: #fff; transform: translateY(-50%) scale(1.08); box-shadow: 0 4px 24px rgba(0,0,0,0.28); }
        .lm-arrow:disabled { opacity: 0.18; cursor: default; transform: translateY(-50%); box-shadow: none; }

        .lm-close-btn {
          position: fixed; top: 20px; right: 20px; z-index: 1100;
          width: 40px; height: 40px; border-radius: 50%;
          background: rgba(0,0,0,0.5); backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.15);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          font-size: 18px; color: #fff; line-height: 1;
          transition: background 0.15s, transform 0.15s;
        }
        .lm-close-btn:hover { background: rgba(0,0,0,0.75); transform: scale(1.08); }

        .lm-right-scroll { overflow-y: auto; flex: 1; }
        .lm-right-scroll::-webkit-scrollbar { width: 0; }

        .lm-img-main { width: 100%; height: 100%; object-fit: cover; display: block; cursor: zoom-in; }

        .lm-thumb {
          width: 76px; height: 54px; border-radius: 7px; object-fit: cover;
          cursor: pointer; opacity: 0.5; border: 2.5px solid transparent;
          transition: all 0.15s; flex-shrink: 0;
        }
        .lm-thumb.active { opacity: 1; border-color: #fff; box-shadow: 0 0 0 1px rgba(255,255,255,0.3); }
        .lm-thumb:hover { opacity: 0.82; }

        .lm-contact-btn {
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%; padding: 17px 24px;
          background: #00274C; color: #FFCB05;
          border: none; border-radius: 14px;
          font-size: 16px; font-weight: 700; font-family: inherit;
          cursor: pointer; text-decoration: none;
          transition: all 0.2s; letter-spacing: -0.01em;
        }
        .lm-contact-btn:hover { background: #003a6e; box-shadow: 0 8px 32px rgba(0,39,76,0.35); transform: translateY(-1px); }
        .lm-contact-btn:active { transform: scale(0.99); }

        .lm-stat-row { display: flex; align-items: baseline; gap: 10px; padding: 14px 0; border-bottom: 1px solid; }

        .lightbox-img { animation: lightbox-in 0.2s ease; max-width: 95vw; max-height: 90vh; border-radius: 10px; object-fit: contain; }

        /* Tablet: stack vertically */
        @media (max-width: 768px) {
          .lm-modal { flex-direction: column !important; }
          .lm-left { width: 100% !important; height: 45vh !important; flex-shrink: 0; }
          .lm-right { width: 100% !important; flex: 1 !important; min-height: 0 !important; }
          .lm-thumbs { display: none !important; }
        }
        /* Mobile: full screen */
        @media (max-width: 390px) {
          .lm-modal { width: 100% !important; height: 100% !important; max-width: 100% !important; max-height: 100% !important; border-radius: 0 !important; flex-direction: column !important; }
          .lm-left { width: 100% !important; height: 40vh !important; flex-shrink: 0; }
          .lm-right { width: 100% !important; flex: 1 !important; min-height: 0 !important; overflow: hidden !important; }
          .lm-thumbs { display: none !important; }
          .lm-overlay { padding: 0 !important; align-items: flex-start !important; }
          .lm-close-btn { top: 12px !important; right: 12px !important; }
        }
      `}</style>

      {/* LIGHTBOX */}
      {lightbox && (
        <div
          onClick={() => setLightbox(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}
        >
          <img src={images[imgIndex]} alt="" className="lightbox-img" onClick={e => e.stopPropagation()} />
          {images.length > 1 && (
            <>
              <button className="lm-arrow" onClick={e => { e.stopPropagation(); prev() }} disabled={imgIndex === 0} style={{ left: 24, position: 'fixed' }}>‹</button>
              <button className="lm-arrow" onClick={e => { e.stopPropagation(); next() }} disabled={imgIndex === images.length - 1} style={{ right: 24, position: 'fixed' }}>›</button>
            </>
          )}
          <button onClick={() => setLightbox(false)} style={{ position: 'fixed', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: '0.05em' }}>
            {imgIndex + 1} / {images.length} · ESC to close
          </div>
        </div>
      )}

      {/* GLOBAL CLOSE BUTTON */}
      <button className="lm-close-btn" onClick={handleClose}>×</button>

      {/* OVERLAY */}
      <div
        className="lm-overlay"
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px',
          opacity: visible ? 1 : 0, transition: 'opacity 0.24s ease',
        }}
      >
        {/* MODAL CARD */}
        <div
          className="lm-modal"
          onClick={e => e.stopPropagation()}
          style={{
            width: '98vw', height: '96vh',
            maxWidth: 1400, maxHeight: '96vh',
            background: bg,
            borderRadius: 18,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'row',
            boxShadow: '0 48px 160px rgba(0,0,0,0.55)',
          }}
        >

          {/* ══ LEFT: IMAGE PANEL ══ */}
          <div
            className="lm-left"
            style={{
              width: '65%', height: '100%',
              background: dm ? '#0a0a0c' : '#0f0f14',
              position: 'relative', flexShrink: 0,
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Main image */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {images.length > 0 ? (
                <>
                  <img
                    key={imgIndex}
                    src={images[imgIndex]}
                    alt={listing.title}
                    className="lm-img-main"
                    onClick={() => setLightbox(true)}
                  />
                  {images.length > 1 && (
                    <>
                      <button className="lm-arrow" onClick={prev} disabled={imgIndex === 0} style={{ left: 16 }}>‹</button>
                      <button className="lm-arrow" onClick={next} disabled={imgIndex === images.length - 1} style={{ right: 16 }}>›</button>
                    </>
                  )}
                  {/* Counter badge */}
                  <div style={{ position: 'absolute', bottom: 16, right: 16, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 11px', borderRadius: 980, letterSpacing: '0.04em' }}>
                    {images.length > 1 ? `${imgIndex + 1} / ${images.length}` : 'Click to zoom'}
                  </div>
                </>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80, opacity: 0.3 }}>🏠</div>
              )}
            </div>

            {/* Thumbnail strip */}
            {images.length > 1 && (
              <div
                className="lm-thumbs"
                style={{
                  display: 'flex', gap: 8, padding: '14px 16px',
                  background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(16px)',
                  overflowX: 'auto', flexShrink: 0,
                  scrollbarWidth: 'none',
                }}
              >
                {images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className={`lm-thumb${i === imgIndex ? ' active' : ''}`}
                    onClick={() => setImgIndex(i)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ══ RIGHT: DETAIL PANEL ══ */}
          <div
            className="lm-right"
            style={{
              flex: 1, height: '100%',
              background: panelBg,
              display: 'flex', flexDirection: 'column',
              minWidth: 0,
            }}
          >
            {/* Scrollable content */}
            <div className="lm-right-scroll" style={{ flex: 1, padding: '48px 44px 0' }}>

              {/* Filled badge */}
              {listing.filled && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: dm ? 'rgba(255,255,255,0.07)' : '#f0f0f0', color: textFaint, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '5px 12px', borderRadius: 6, marginBottom: 16 }}>
                  ● Filled
                </div>
              )}

              {/* Title */}
              <h2 style={{ fontSize: 30, fontWeight: 800, color: textPrimary, letterSpacing: '-0.04em', lineHeight: 1.15, marginBottom: 10 }}>
                {listing.title}
              </h2>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color: '#00274C', letterSpacing: '-0.04em', ...(dm && { color: '#FFCB05' }) }}>
                  ${Number(listing.price).toLocaleString()}
                </span>
                <span style={{ fontSize: 16, color: textFaint, fontWeight: 500 }}>/mo</span>
              </div>

              {/* Address */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 32, color: textSub, fontSize: 14 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                {listing.address}
              </div>

              {/* Divider */}
              <div style={{ height: 1, background: border, marginBottom: 28 }} />

              {/* Stats: label + value pairs */}
              <div style={{ marginBottom: 32 }}>
                {listing.beds && (
                  <div className="lm-stat-row" style={{ borderBottomColor: border }}>
                    <span style={{ fontSize: 13, color: textFaint, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', width: 100, flexShrink: 0 }}>Bedrooms</span>
                    <span style={{ fontSize: 15, color: textPrimary, fontWeight: 600 }}>{listing.beds}</span>
                  </div>
                )}
                {listing.dates && (
                  <div className="lm-stat-row" style={{ borderBottomColor: border }}>
                    <span style={{ fontSize: 13, color: textFaint, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', width: 100, flexShrink: 0 }}>Dates</span>
                    <span style={{ fontSize: 15, color: textPrimary, fontWeight: 600 }}>{listing.dates}</span>
                  </div>
                )}
                <div className="lm-stat-row" style={{ borderBottomColor: border }}>
                  <span style={{ fontSize: 13, color: textFaint, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', width: 100, flexShrink: 0 }}>Verified</span>
                  <span style={{ fontSize: 15, color: '#16a34a', fontWeight: 600 }}>✓ UMich Student</span>
                </div>
                <div className="lm-stat-row" style={{ borderBottomColor: 'transparent' }}>
                  <span style={{ fontSize: 13, color: textFaint, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', width: 100, flexShrink: 0 }}>Listed by</span>
                  <span style={{ fontSize: 15, color: textPrimary, fontWeight: 600 }}>{listing.contact_email?.split('@')[0] || 'UMich Student'}</span>
                </div>
              </div>

              {/* Description */}
              {listing.description && (
                <div style={{ marginBottom: 36 }}>
                  <div style={{ height: 1, background: border, marginBottom: 28 }} />
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>
                    About this place
                  </h3>
                  <p style={{ fontSize: 15, color: textSub, lineHeight: 1.85, fontWeight: 400 }}>
                    {listing.description}
                  </p>
                </div>
              )}

              {/* Amenities */}
              {tags.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  <div style={{ height: 1, background: border, marginBottom: 28 }} />
                  <h3 style={{ fontSize: 12, fontWeight: 700, color: textFaint, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 18 }}>
                    Amenities
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {tags.map(tag => (
                      <div key={tag} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: tagBg, border: `1px solid ${tagBorder}` }}>
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{TAG_ICONS[tag] || '•'}</span>
                        <span style={{ fontSize: 14, color: textPrimary, fontWeight: 500 }}>{tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom spacer so content doesn't hide behind footer */}
              <div style={{ height: 24 }} />
            </div>

            {/* ── STICKY FOOTER CTA ── */}
            <div style={{
              padding: '20px 44px 28px',
              borderTop: `1px solid ${border}`,
              background: panelBg,
              flexShrink: 0,
            }}>
              {listing.contact_email ? (
                <a
                  href={`mailto:${listing.contact_email}?subject=Interested in your sublease: ${listing.title}&body=Hi, I saw your listing on Subly and I'm interested. Could we connect?`}
                  className="lm-contact-btn"
                >
                  ✉ Contact Lister
                </a>
              ) : (
                <div className="lm-contact-btn" style={{ opacity: 0.4, cursor: 'default', pointerEvents: 'none' }}>
                  No contact info available
                </div>
              )}
              <p style={{ textAlign: 'center', fontSize: 12, color: textFaint, marginTop: 12 }}>
                ✓ @umich.edu verified listing
              </p>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
