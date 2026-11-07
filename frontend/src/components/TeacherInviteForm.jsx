import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, LockKeyhole, Mail } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { isPasswordStrong } from './PasswordStrengthIndicator';
import { postInviteAction, resendCooldownAfter, RESEND_COOLDOWN_SECONDS, withPending } from '../utils/teacherInvite';

export default function TeacherInviteForm({ invitation, onComplete, onBack, onVerified }) {
  const [code, setCode] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState('');
  const busy = pending !== '';
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [wait, setWait] = useState(0);
  const codeInput = useRef(null);
  const passwordInput = useRef(null);
  useEffect(() => { if (setupToken) passwordInput.current?.focus(); }, [setupToken]);
  useEffect(() => { codeInput.current?.focus(); }, []);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  function request(action, payload = {}) {
    return postInviteAction(apiFetch, action, { challengeToken: invitation.challengeToken, ...payload });
  }
  async function resend() {
    if (busy || wait) return;
    setError(''); setMessage('');
    try {
      const data = await withPending(setPending, 'resend', () => request('resend'));
      setCode(''); setMessage(data.message || 'A new code was sent to your email and expires in 10 minutes.'); setWait(RESEND_COOLDOWN_SECONDS);
    } catch (error) { setError(error.message); setWait(resendCooldownAfter(error.status)); }
    codeInput.current?.focus();
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (setupToken && password !== confirm) { setError('The new passwords do not match.'); return; }
    if (setupToken && (!isPasswordStrong(password) || new TextEncoder().encode(password).length > 72)) {
      setError('Use at least 8 characters with uppercase, lowercase, a number and a symbol. Maximum 72 bytes.'); return;
    }
    setError(''); setMessage('');
    try {
      if (!setupToken) {
        const data = await withPending(setPending, 'verify', () => request('verify', { code }));
        if (!data.setupToken) throw new Error('Email verification could not finish. Please try again.');
        setSetupToken(data.setupToken); setCode(''); onVerified();
        return;
      }
      const data = await withPending(setPending, 'activate', () => request('activate', { setupToken, password }));
      if (!data.token || !data.user) throw new Error('Please sign in again with your new password.');
      onComplete(data.user.role, data);
    } catch (error) { setError(error.message); }
  }
  return <form onSubmit={submit} aria-busy={busy} className="lb-invite-form">
    <p className="lb-invite-step" role="status">Step {setupToken ? '2 of 2 · Email verified' : '1 of 2 · Email verification'}</p>
    {!setupToken && <><p className="lb-invite-email">Enter the latest code emailed to <strong>{invitation.email}</strong>. Codes expire after 10 minutes; if yours has expired or never arrived, tap Resend code.</p>
    <div className="lb-login-field">
      <label htmlFor="invite-code">Email verification code</label>
      <div className="lb-login-input-wrap"><Mail size={18} aria-hidden="true" /><input ref={codeInput} id="invite-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="6-digit code" /></div>
    </div>
    </>}
    {setupToken && <><div className="lb-login-field">
      <label htmlFor="invite-password">Choose a new password</label>
      <div className="lb-login-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input ref={passwordInput} id="invite-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} aria-describedby="invite-password-help" /></div>
      <small id="invite-password-help">8+ characters, uppercase, lowercase, number and symbol.</small>
    </div>
    <div className="lb-login-field">
      <label htmlFor="invite-confirm">Confirm new password</label>
      <div className="lb-login-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="invite-confirm" type="password" autoComplete="new-password" maxLength={72} required disabled={busy} value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
    </div>
    </>}
    {error && <div className="lb-login-error" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{error}</span></div>}
    {message && <p className="lb-invite-message" role="status">{message}</p>}
    <button className="lb-login-submit" type="submit" disabled={busy}>{pending === 'verify' ? 'Checking code…' : pending === 'activate' ? 'Setting password…' : setupToken ? 'Set password & sign in' : 'Verify email code'}</button>
    <div className="lb-invite-actions">{!setupToken && <button type="button" disabled={busy || wait > 0} onClick={resend}>{pending === 'resend' ? 'Sending code…' : wait ? `Resend in ${wait}s` : 'Resend code'}</button>}<button type="button" disabled={busy} onClick={onBack}><ArrowLeft size={14} aria-hidden="true" />Back to sign in</button></div>
  </form>;
}
