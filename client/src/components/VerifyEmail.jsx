import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import VerifiedBadge from './VerifiedBadge.jsx';

/** Verify a college/work email with a 6-digit code to earn a badge. */
export default function VerifyEmail() {
  const { user, setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(null); // response from /verify/start
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function start(e) {
    e?.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/me/verify/start', { method: 'POST', body: { email } });
      setSent(r);
      setCode('');
      setCooldown(r.resendInSeconds);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/me/verify/confirm', { method: 'POST', body: { code } });
      setUser(r.user);
      setSent(null);
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function removeBadge() {
    if (!window.confirm('Remove your verified badge?')) return;
    setUser((await api('/me/verify', { method: 'DELETE' })).user);
  }

  if (user.verified) {
    return (
      <div className="verify">
        <VerifiedBadge verified={user.verified} />
        <p className="muted small">
          Verified with <b>{user.verifiedEmail}</b>. Others see only the badge and the domain, never your address.
        </p>
        <button type="button" className="link small" onClick={removeBadge}>Remove badge</button>
      </div>
    );
  }

  return (
    <div className="verify">
      <p className="muted small">
        Verify a <b>college email</b> (e.g. <i>name@yourcollege.ac.in</i>) or a <b>work email</b> to get a badge. It
        shows people you're a real student or professional. Personal addresses like Gmail can't be used.
      </p>

      {!sent ? (
        <form className="row gap" onSubmit={start}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@college.ac.in"
            required aria-label="College or work email" className="grow" />
          <button className="btn btn-primary" disabled={busy || !email}>{busy ? 'Sending…' : 'Send code'}</button>
        </form>
      ) : (
        <form className="verify-code" onSubmit={confirm}>
          <p className="small">
            We sent a 6-digit code to <b>{sent.sentTo}</b>. It expires in {sent.expiresInMinutes} minutes.
          </p>
          {sent.devCode && (
            <p className="dev-hint small">
              <b>Development mode:</b> no email server is configured, so here's the code: <code>{sent.devCode}</code>
            </p>
          )}
          <div className="row gap">
            <input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" aria-label="Verification code"
              className="code-input" />
            <button className="btn btn-primary" disabled={busy || code.length !== 6}>{busy ? 'Checking…' : 'Verify'}</button>
          </div>
          <div className="row gap small">
            <button type="button" className="link" disabled={cooldown > 0 || busy} onClick={start}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button type="button" className="link" onClick={() => { setSent(null); setError(''); }}>Use a different email</button>
          </div>
        </form>
      )}
      {error && <p className="error-box">{error}</p>}
    </div>
  );
}
