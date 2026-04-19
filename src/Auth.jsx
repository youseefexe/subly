import { useState } from 'react'
import { SublyLogo, SublyWordmark } from './Logo'
import { supabase } from './supabase'

export default function Auth({ onBack, onLogin, initialMode = 'signup', darkMode, onToggleDark }) {
  const dm = darkMode
  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setError('')
    setMessage('')
    if (!email.endsWith('@umich.edu')) {
      setError('Only @umich.edu emails are allowed.')
      return
    }
    setLoading(true)
    if (mode === 'signup') {
const { error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: 'http://localhost:5173'
  }
})
      if (error) setError(error.message)
      else setMessage('Check your @umich.edu inbox to confirm your account.')
    } else {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else if (onLogin) onLogin(data.user)
    }
    setLoading(false)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body { font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; background: #fff; }

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
        }
        .auth-input:focus {
          background: #fff;
          border-color: #00274C;
          box-shadow: 0 0 0 3px rgba(0,39,76,0.08);
        }
        .auth-input::placeholder { color: #c7c7cc; }
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
          border-radius: 12px;
          padding: 14px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: -0.01em;
        }
        .submit-btn:hover { background: #003a6e; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,39,76,0.2); }
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
      `}</style>

      <button className="dark-toggle" onClick={onToggleDark} title={dm ? 'Light mode' : 'Dark mode'} style={{ borderColor: dm ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)', background: dm ? 'rgba(255,255,255,0.08)' : '#f5f5f7' }}>
        {dm ? '☀️' : '🌙'}
      </button>
      <div style={{
        minHeight: '100vh',
        background: dm ? 'linear-gradient(160deg, #0f0f18 0%, #0f0f11 50%, #0f0e0f 100%)' : 'linear-gradient(160deg, #f0f4ff 0%, #fff 50%, #fffdf0 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'Inter, sans-serif',
      }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Back button */}
          <button className="back-btn" onClick={onBack} style={{ marginBottom: 40 }}>
            ← Back to home
          </button>

          {/* Logo + heading */}
          <div style={{ marginBottom: 36 }}>
            <div style={{ marginBottom: 20 }}>
  <div onClick={onBack} style={{cursor:"pointer"}}><SublyLogo size={40} /></div>
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 900, color: dm ? '#f5f5f7' : '#00274C', letterSpacing: '-0.04em', marginBottom: 8 }}>
              {mode === 'signup' ? 'Create your account.' : 'Welcome back.'}
            </h1>
            <p style={{ fontSize: 15, color: dm ? '#8e8e93' : '#aeaeb2', fontWeight: 400, lineHeight: 1.5 }}>
              {mode === 'signup'
                ? 'UMich students only. Sign up with your @umich.edu email.'
                : 'Sign in to browse and manage your listings.'}
            </p>
          </div>

          {/* Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <input
                className="auth-input"
                type="email"
                placeholder="uniqname@umich.edu"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                autoFocus
              />
            </div>
            <div>
              <input
                className="auth-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              />
            </div>
          </div>

          {/* Error / success */}
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

          {/* Submit */}
          <button className="submit-btn" onClick={handleSubmit} disabled={loading} style={{ marginBottom: 24 }}>
            {loading ? 'Loading...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ flex: 1, height: 1, background: dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
            <span style={{ fontSize: 12, color: dm ? '#636366' : '#c7c7cc' }}>or</span>
            <div style={{ flex: 1, height: 1, background: dm ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />
          </div>

          {/* Switch mode */}
          <p style={{ textAlign: 'center', fontSize: 14, color: dm ? '#8e8e93' : '#aeaeb2' }}>
            {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
            <button className="switch-btn" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(''); setMessage('') }}>
              {mode === 'signup' ? 'Sign in' : 'Sign up'}
            </button>
          </p>

          {/* Fine print */}
          <p style={{ textAlign: 'center', fontSize: 11, color: '#d2d2d7', marginTop: 28, lineHeight: 1.6 }}>
            By continuing you confirm you are a University of Michigan student.
          </p>
        </div>
      </div>
    </>
  )
}
