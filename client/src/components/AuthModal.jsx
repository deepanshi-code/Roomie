import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from './Icon.jsx';

/** Sign up / log in in a pop-up sheet, opened from anywhere on the landing page. */
export default function AuthModal({ initialMode = 'register', note = '', onClose }) {
  const { login } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstField = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  useEffect(() => { firstField.current?.focus(); setError(''); }, [mode]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;
      const data = await api(`/auth/${mode === 'login' ? 'login' : 'register'}`, { method: 'POST', body });
      login(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={onClose}>
      <form className="modal auth-modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="icon-btn modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        <div className="auth-modal-head">
          <span className="brand-mark"><Icon name="home" size={20} /></span>
          <h2 id="auth-title">{mode === 'login' ? 'Welcome back' : 'Find your roommate'}</h2>
          <p className="muted small">
            {mode === 'login' ? 'Log in to see your matches and messages.' : 'Free to join. Setup takes about 3 minutes.'}
          </p>
        </div>
        {note && <p className="info-box auth-note"><Icon name="home" size={16} /> {note}</p>}
        <div className="tabs">
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Sign up</button>
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Log in</button>
        </div>
        {mode === 'register' && (
          <label className="field">Your name
            <input ref={firstField} value={form.name} onChange={set('name')} required maxLength={50} autoComplete="name" placeholder="e.g. Ananya Rawat" />
          </label>
        )}
        <label className="field">Email
          <input ref={mode === 'login' ? firstField : undefined} type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
        </label>
        <label className="field">Password
          <span className="pw-wrap">
            <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="At least 8 characters" />
            <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}>
              {showPw ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>
        {error && <p className="error-box" role="alert">{error}</p>}
        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'One sec…' : mode === 'login' ? 'Log in' : 'Create account'} {!busy && <Icon name="chevron" size={18} />}
        </button>
        <p className="muted small center" style={{ margin: 0 }}>
          {mode === 'login'
            ? <>New here? <button type="button" className="link" onClick={() => setMode('register')}>Create an account</button></>
            : <>Already have an account? <button type="button" className="link" onClick={() => setMode('login')}>Log in</button></>}
        </p>
        {import.meta.env.DEV && (
          <button type="button" className="demo-btn" onClick={() => { setMode('login'); setForm({ name: '', email: 'demo@roomie.test', password: 'demo1234' }); }}>
            Fill in the local demo account
          </button>
        )}
      </form>
    </div>
  );
}
