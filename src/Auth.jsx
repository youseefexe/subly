import { useState } from 'react'
import { SublyLogo, SublyWordmark } from './Logo'
import { supabase } from './supabase'

const USER_TYPES = [
  {
    id: 'find',
    label: 'Find a sublease',
    sub: 'I\'m looking for housing from another student.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    id: 'list',
    label: 'List my place',
    sub: 'I have a place I want to sublease to another student.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'both',
    label: 'Both',
    sub: 'I want to browse listings and may also list my own.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 11H7a5 5 0 0 0 0 10h10a5 5 0 0 0 0-10z"/><circle cx="7" cy="16" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="16" r="1" fill="currentColor" stroke="none"/><path d="M8.5 6.5C9 5 10.5 4 12 4s3 1 3.5 2.5"/>
      </svg>
    ),
  },
]

export default function Auth({ onBack, onLogin, initialMode = 'signup', darkMode, onToggleDark }) {
  const dm = darkMode
  const [mode, setMode] = useState(initialMode)
  const [step, setStep] = useState('credentials') // 'credentials' | 'user_type'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [userType, setUserType] = useState(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const card = dm ? '#1c1c1e' : '#fff'
  const bg = dm ? 'linear-gradient(160deg, #0f0f18 0%, #0f0f11 50%, #0f0e0f 100%)' : 'linear-gradient(160deg, #f0f4ff 0%, #fff 50%, #fffdf0 100%)'
  const tp = dm ? '#f5f5f7' : '#1d1d1f'
  const ts = dm ? '#8e8e93' : '#6e6e73'
  const border = dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'

  const validateCredentials = () => {
    if (!email.endsWith('@umich.edu')) {
      setError('Only @umich.edu emails are allowed.')
      return false
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    return true
  }

  const handleCredentialsNext = () => {
    setError('')
    if (!validateCredentials()) return
    setStep('user_type')
  }

  const handleSignup = async () => {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { user_type: userType },
      },
    })
    if (error) setError(error.message)
    else setMessage('Check your @umich.edu inbox to confirm your account.')
    setLoading(false)
  }

  const handleSignin = async () => {
    setError('')
    setLoading(true)
    const { error, data } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else if (onLogin) onLogin(data.user)
    setLoading(false)
  }

  const handleBack = () => {
    if (step === 'user_type') {
      setStep('credentials')
      setUserType(null)
      setError('')
    } else {
      onBack()
    }
  }

  const switchMode = (newMode) => {
    setMode(newMode)
    setStep('credentials')
    setUserType(null)
    setError('')
    setMessage('')
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; background: transparent; }
        [data-theme="dark"] body { background: #0f0f11; }

        .auth-input {
          width: 100%;
          background: #f7f7f8;
          border: 1.5px solid transparent;
          border-radius: 12px;
          padding: 14px 16px;
          font-size: 15px;
          font-family: inherit;
          color: #1d1d1f;
          transition: all 0.2s;
          outline: none;
          -webkit-appearance: none;
        }
        .auth-input:focus {
          background: #fff;
          border-color: #00274C;
          box-shadow: 0 0 0 3px rgba(0,39,76,0.08);
        }
        .auth-input::placeholder { color: #aeaeb2; }

        .dark-toggle { width: 36px; height: 36px; border-radius: 50%; cursor: pointer; font-size: 15px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; border: 1.5px solid; position: fixed; top: 16px; right: 16px; z-index: 50; }
        .dark-toggle:hover { transform: scale(1.1); }

        [data-theme="dark"] .auth-input { background: #2c2c2e; color: #f5f5f7; border-color: rgba(255,255,255,0.08); }
        [data-theme="dark"] .auth-input:focus { background: #3a3a3c; border-color: #FFCB05; box-shadow: 0 0 0 3px rgba(255,203,5,0.1); }
        [data-theme="dark"] .auth-input::placeholder { color: #636366; }
        [data-theme="dark"] .back-btn { color: #636366; }
        [data-theme="dark"] .back-btn:hover { color: #f5f5f7; }
        [data-theme="dark"] .switch-btn { color: #FFCB05; }

        .submit-btn {
          width: 100%;
          background: #00274C;
          color: #FFCB05;
          border: none;
          border-radius: 980px;
          padding: 14px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: -0.01em;
        }
        .submit-btn:hover { background: #003a6e; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,39,76,0.25); }
        .submit-btn:active { transform: scale(0.98); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; box-shadow: none; }

        .switch-btn {
          background: none;
          border: none;
          color: #00274C;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          padding: 0;
          transition: opacity 0.15s;
        }
        .switch-btn:hover { opacity: 0.7; }

        .back-btn {
          background: none;
          border: none;
          color: #aeaeb2;
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: color 0.15s;
          padding: 0;
        }
        .back-btn:hover { color: #1d1d1f; }

        .type-card {
          width: 100%;
          border-radius: 16px;
          border: 2px solid;
          padding: 20px;
          cursor: pointer;
          transition: all 0.18s ease;
          text-align: left;
          background: none;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .type-card:hover { transform: translateY(-1px); }

        @keyframes slide-up {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .step-animate { animation: slide-up 0.25s ease; }
      `}</style>

      <button className="dark-toggle" onClick={onToggleDark} title={dm ? 'Light mode' : 'Dark mode'} style={{ borderColor: dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', background: dm ? 'rgba(255,255,255,0.08)' : '#f5f5f7' }}>
        {dm ? '☀️' : '🌙'}
      </button>

      <div style={{
        minHeight: '100vh',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ width: '100%', maxWidth: step === 'user_type' ? 480 : 400, transition: 'max-width 0.25s ease' }}>

          {/* Back button */}
          <button className="back-btn" onClick={handleBack} style={{ marginBottom: 40 }}>
            ← {step === 'user_type' ? 'Back' : 'Back to home'}
          </button>

          {/* ── STEP 1: Credentials ── */}
          {step === 'credentials' && (
            <div className="step-animate">
              {/* Logo + heading */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ marginBottom: 20 }}>
                  <div onClick={onBack} style={{ cursor: 'pointer' }}><SublyLogo size={40} /></div>
                </div>
                <h1 style={{ fontSize: 30, fontWeight: 900, color: dm ? '#f5f5f7' : '#00274C', letterSpacing: '-0.04em', marginBottom: 8 }}>
                  {mode === 'signup' ? 'Create your account.' : 'Welcome back.'}
                </h1>
                <p style={{ fontSize: 15, color: ts, fontWeight: 400, lineHeight: 1.5 }}>
                  {mode === 'signup'
                    ? 'UMich students only. Sign up with your @umich.edu email.'
                    : 'Sign in to browse and manage your listings.'}
                </p>
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="uniqname@umich.edu"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'signup' ? handleCredentialsNext() : handleSignin())}
                  autoFocus
                />
                <input
                  className="auth-input"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  onKeyDown={e => e.key === 'Enter' && (mode === 'signup' ? handleCredentialsNext() : handleSignin())}
                />
              </div>

              {error && (
                <div style={{ background: dm ? 'rgba(220,38,38,0.12)' : '#FEF2F2', border: `1px solid ${dm ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.15)'}`, color: dm ? '#ff6b6b' : '#DC2626', fontSize: 13, padding: '11px 14px', borderRadius: 10, marginBottom: 16, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}
              {message && (
                <div style={{ background: dm ? 'rgba(34,197,94,0.1)' : '#F0FDF4', border: `1px solid ${dm ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.2)'}`, color: dm ? '#4ade80' : '#16A34A', fontSize: 13, padding: '11px 14px', borderRadius: 10, marginBottom: 16, lineHeight: 1.5 }}>
                  {message}
                </div>
              )}

              <button
                className="submit-btn"
                onClick={mode === 'signup' ? handleCredentialsNext : handleSignin}
                disabled={loading}
                style={{ marginBottom: 24 }}>
                {loading ? 'Loading...' : mode === 'signup' ? 'Continue →' : 'Sign in'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <div style={{ flex: 1, height: 1, background: border }} />
                <span style={{ fontSize: 12, color: dm ? '#636366' : '#c7c7cc' }}>or</span>
                <div style={{ flex: 1, height: 1, background: border }} />
              </div>

              <p style={{ textAlign: 'center', fontSize: 14, color: ts }}>
                {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
                <button className="switch-btn" onClick={() => switchMode(mode === 'signup' ? 'signin' : 'signup')}>
                  {mode === 'signup' ? 'Sign in' : 'Sign up'}
                </button>
              </p>

              <p style={{ textAlign: 'center', fontSize: 11, color: '#d2d2d7', marginTop: 28, lineHeight: 1.6 }}>
                By continuing you confirm you are a University of Michigan student.
              </p>
            </div>
          )}

          {/* ── STEP 2: User type ── */}
          {step === 'user_type' && (
            <div className="step-animate">
              {/* Progress dots */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 40 }}>
                {[0, 1].map(i => (
                  <div key={i} style={{ height: 4, borderRadius: 2, background: i === 0 ? (dm ? '#FFCB05' : '#00274C') : (dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'), width: i === 1 ? 28 : 16, transition: 'all 0.2s' }} />
                ))}
              </div>

              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 900, color: dm ? '#f5f5f7' : '#00274C', letterSpacing: '-0.04em', marginBottom: 8 }}>
                  What brings you to Subly?
                </h1>
                <p style={{ fontSize: 15, color: ts, lineHeight: 1.5 }}>
                  Choose the option that fits best. You can always change this later.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {USER_TYPES.map(type => {
                  const selected = userType === type.id
                  return (
                    <button
                      key={type.id}
                      className="type-card"
                      onClick={() => setUserType(type.id)}
                      style={{
                        borderColor: selected
                          ? (dm ? '#FFCB05' : '#00274C')
                          : (dm ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.09)'),
                        background: selected
                          ? (dm ? 'rgba(255,203,5,0.08)' : 'rgba(0,39,76,0.04)')
                          : card,
                        boxShadow: selected ? `0 0 0 1px ${dm ? '#FFCB05' : '#00274C'}` : 'none',
                      }}>
                      {/* Icon */}
                      <div style={{
                        width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                        background: selected
                          ? (dm ? 'rgba(255,203,5,0.15)' : 'rgba(0,39,76,0.08)')
                          : (dm ? 'rgba(255,255,255,0.06)' : '#f5f5f7'),
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: selected ? (dm ? '#FFCB05' : '#00274C') : ts,
                        transition: 'all 0.18s',
                      }}>
                        {type.icon}
                      </div>

                      {/* Text */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 700, color: selected ? (dm ? '#FFCB05' : '#00274C') : tp, marginBottom: 3, transition: 'color 0.15s' }}>
                          {type.label}
                        </div>
                        <div style={{ fontSize: 13, color: ts, lineHeight: 1.5 }}>
                          {type.sub}
                        </div>
                      </div>

                      {/* Radio indicator */}
                      <div style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${selected ? (dm ? '#FFCB05' : '#00274C') : (dm ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)')}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s',
                      }}>
                        {selected && (
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: dm ? '#FFCB05' : '#00274C' }} />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {error && (
                <div style={{ background: dm ? 'rgba(220,38,38,0.12)' : '#FEF2F2', border: `1px solid ${dm ? 'rgba(220,38,38,0.25)' : 'rgba(220,38,38,0.15)'}`, color: dm ? '#ff6b6b' : '#DC2626', fontSize: 13, padding: '11px 14px', borderRadius: 10, marginBottom: 16, lineHeight: 1.5 }}>
                  {error}
                </div>
              )}
              {message && (
                <div style={{ background: dm ? 'rgba(34,197,94,0.1)' : '#F0FDF4', border: `1px solid ${dm ? 'rgba(34,197,94,0.25)' : 'rgba(34,197,94,0.2)'}`, color: dm ? '#4ade80' : '#16A34A', fontSize: 13, padding: '11px 14px', borderRadius: 10, marginBottom: 16, lineHeight: 1.5 }}>
                  {message}
                </div>
              )}

              <button
                className="submit-btn"
                onClick={handleSignup}
                disabled={!userType || loading}
                style={{ marginBottom: 16 }}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>

              <p style={{ textAlign: 'center', fontSize: 11, color: '#d2d2d7', lineHeight: 1.6 }}>
                By continuing you confirm you are a University of Michigan student.
              </p>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
