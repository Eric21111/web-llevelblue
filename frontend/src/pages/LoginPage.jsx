import { useState } from "react";
import {
  X, ArrowRight, BookOpen, AlertCircle, Eye, EyeOff,
  LoaderCircle, LockKeyhole, Mail, Shield, KeyRound, ShieldCheck,
} from "lucide-react";
import FontImports from "../components/FontImports";
import TeacherInviteForm from "../components/TeacherInviteForm";
import { apiFetch } from "../utils/api";
import "./LoginPage.css";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [inviteVerified, setInviteVerified] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    if (!email.trim() || !password.trim()) {
      setError("Enter your email address and password to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(res.status >= 500
          ? "We couldn’t connect to the sign-in service. Please try again in a moment."
          : data?.error || "We couldn’t sign you in. Check your email and password and try again.");
      }
      if (data?.requiresInviteVerification && data.challengeToken) {
        setInvitation(data);
        setPassword('');
        return;
      }
      if (!data?.token || !data?.user?.role) {
        throw new Error("Sign-in could not be completed. Please try again.");
      }
      if(!["admin","super","developer"].includes(data.user.role))throw new Error("Student accounts sign in through the LEVELBLUE mobile app.");
      onLogin(data.user.role, data);
    } catch (err) {
      setError(err instanceof TypeError
        ? "We couldn’t connect. Check your internet connection and try again."
        : err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lb-login">
      <FontImports />
      <a className="lb-login-back" href="/" aria-label="Back to home" title="Back to home"><X size={20} aria-hidden="true" /></a>
      <main className="lb-login-main">
        <div className="lb-login-card">
          <aside className="lb-login-story" aria-labelledby="login-story-title">
            <div className="lb-login-art" aria-hidden="true">
              <div className="lb-login-art-grid" />
              <div className="lb-login-book"><BookOpen strokeWidth={1.3} /></div>
              <div className="lb-login-art-bars"><i /><i /><i /><i /></div>
              <span className="lb-login-art-shield"><ShieldCheck strokeWidth={1.5} /></span>
            </div>
            <div className="lb-login-story-copy">
              <h2 id="login-story-title">See learning.<br /><span>Guide progress.</span></h2>
              <p>Turn students’ cybersecurity learning into a clearer picture of who needs your support.</p>
              {invitation && <ol className="lb-invite-guide">
                <li><KeyRound aria-hidden="true" /><span>Temporary password entered</span></li>
                <li aria-current={!inviteVerified ? 'step' : undefined}><Mail aria-hidden="true" /><span>Verify your email</span></li>
                <li aria-current={inviteVerified ? 'step' : undefined}><ShieldCheck aria-hidden="true" /><span>Choose your password</span></li>
              </ol>}
              {!invitation && <div className="lb-login-story-footer">Your classroom. Your insights. Your next step.</div>}
            </div>
          </aside>

          <section className="lb-login-form-panel" aria-labelledby="login-title">
            <div className="lb-login-form-content">
            <a className="lb-login-brand" href="/" aria-label="LEVELBLUE home">
              <Shield size={29} aria-hidden="true" /><span>LEVEL<span>BLUE</span></span>
            </a>
            <h1 id="login-title">{invitation ? (inviteVerified ? 'Choose a password.' : 'Verify your email.') : 'Welcome back.'}</h1>
            <p className="lb-login-intro">{invitation ? (inviteVerified ? 'Replace your temporary password to finish setting up your account.' : 'Confirm your email before setting up your password.') : 'Use the account provided by your school.'}</p>

            {invitation ? <TeacherInviteForm invitation={invitation} onComplete={onLogin} onVerified={() => setInviteVerified(true)} onBack={() => { setInviteVerified(false); setInvitation(null); setError(''); }} /> : <form onSubmit={handleSubmit} aria-busy={loading}>
              <div className="lb-login-field">
                <label htmlFor="login-email">Email address</label>
                <div className="lb-login-input-wrap">
                  <Mail size={18} aria-hidden="true" />
                  <input id="login-email" name="email" autoComplete="username" type="email" inputMode="email" autoCapitalize="none" spellCheck={false} required disabled={loading} value={email} onChange={event => { setEmail(event.target.value); setError(""); }} placeholder="Enter your account email" aria-describedby={error ? "login-error" : undefined} />
                </div>
              </div>
              <div className="lb-login-field">
                <label htmlFor="login-password">Password</label>
                <div className="lb-login-input-wrap">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input id="login-password" name="password" autoComplete="current-password" type={showPw ? "text" : "password"} required disabled={loading} value={password} onChange={event => { setPassword(event.target.value); setError(""); }} placeholder="Enter your password" aria-describedby={error ? "login-error" : undefined} />
                  <button className="lb-login-password-toggle" type="button" disabled={loading} aria-label={showPw ? "Hide password" : "Show password"} aria-pressed={showPw} onClick={() => setShowPw(value => !value)}>{showPw ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}</button>
                </div>
              </div>

              {error && <div className="lb-login-error" id="login-error" role="alert"><AlertCircle size={17} aria-hidden="true" /><span>{error}</span></div>}

              <button className="lb-login-submit" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="lb-login-spinner" size={18} aria-hidden="true" />Signing in…</> : <>Sign in<ArrowRight size={18} aria-hidden="true" /></>}</button>
            </form>}

            {!invitation && <div className="lb-login-help">
              <details><summary>First time signing in?</summary><p>Use your school email and temporary password. Next, verify the code sent to your email and choose a new password.</p></details>
              <p>Need password recovery? <span>Contact your school administrator.</span></p>
            </div>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
