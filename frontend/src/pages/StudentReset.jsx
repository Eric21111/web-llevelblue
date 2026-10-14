import { useEffect, useState } from 'react';
import { ShieldCheck, KeyRound } from 'lucide-react';
import './StudentReset.css';

export default function StudentReset() {
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { window.history.replaceState(null, '', window.location.pathname); }, []);
  const rules = [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password), new TextEncoder().encode(password).length <= 72];
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (!rules.every(Boolean) || password !== confirmation) { setError('Check the password requirements and make sure both entries match.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/student-recovery/reset`, { method: 'POST', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(25000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, newPassword: password, confirmPassword: confirmation }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update your password. Please try again.');
      setSuccess(body.message); setToken(''); setPassword(''); setConfirmation('');
    } catch (e) { setError(e.name === 'TimeoutError' ? 'The request timed out. Try signing in to the game with your new password before retrying this link.' : e.message); }
    finally { setBusy(false); }
  }
  return <main className="student-reset"><section className="student-reset-card"><div className="student-reset-mark"><ShieldCheck size={36}/><span>LEVELBLUE<br/><small>SECURE ACCOUNT RECOVERY</small></span></div>
    <h1>{success ? 'Ready for your next mission' : 'Choose a new password'}</h1>
    {success ? <p role="status" className="reset-success">{success}</p> : !/^[A-Za-z0-9_-]{43}$/.test(token) ? <p role="alert">Open the reset link from your email. If it has expired, request password assistance from the game’s login screen. If you refreshed this page, reopen the original email link.</p> : <><p>Your teacher approved your request. Set a password only you know. Your lessons, mastery and game progress stay with you.</p>
      <form onSubmit={submit}><fieldset disabled={busy}><legend>Student password</legend><label htmlFor="reset-password">New password</label><input id="reset-password" type={show ? 'text' : 'password'} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)}/><button className="reset-show" type="button" aria-pressed={show} onClick={() => setShow(v => !v)}>{show ? 'Hide passwords' : 'Show passwords'}</button>
      <ul className="reset-rules">{['8 or more characters', 'An uppercase letter', 'A lowercase letter', 'A number', 'A symbol', 'Maximum 72 UTF-8 bytes'].map((label, index) => <li key={label} className={rules[index] ? 'met' : ''}>{rules[index] ? '✓' : '○'} {label}</li>)}</ul>
      <label htmlFor="reset-confirm">Confirm password</label><input id="reset-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)}/>
      {error && <p role="alert" className="reset-error">{error}</p>}<button className="reset-submit" type="submit"><KeyRound size={18}/>{busy ? 'Securing account…' : 'Save new password'}</button></fieldset></form></>}
    <p className="reset-note">Never share your password or reset link. You can close this page and return to the game after your password is updated.</p>
  </section></main>;
}
