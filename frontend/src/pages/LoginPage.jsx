import { useState } from "react";
import {
  ArrowLeft, ArrowRight, AlertCircle, BarChart3, Check, Eye, EyeOff,
  GraduationCap, LoaderCircle, LockKeyhole, Mail, Shield, ShieldCheck, Users,
} from "lucide-react";
import FontImports from "../components/FontImports";
import { apiFetch } from "../utils/api";
import "./LoginPage.css";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      if (!data?.token || !data?.user?.role) {
        throw new Error("Sign-in could not be completed. Please try again.");
      }
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
      <header className="lb-login-header">
        <a className="lb-login-brand" href="/" aria-label="LEVELBLUE home">
          <span className="lb-login-brand-icon"><Shield size={23} aria-hidden="true" /></span>
          <span>LEVEL<span>BLUE</span><small>LEARN. RECOGNIZE. PROTECT.</small></span>
        </a>
        <a className="lb-login-back" href="/"><ArrowLeft size={15} aria-hidden="true" />Back to home</a>
      </header>

      <main className="lb-login-main">
        <div className="lb-login-card">
          <aside className="lb-login-story" aria-labelledby="login-story-title">
            <span className="lb-login-eyebrow"><span />AWARENESS STARTS WITH UNDERSTANDING</span>
            <h2 id="login-story-title">Better insights.<br /><em>Safer digital habits.</em></h2>
            <p>A clearer view of learning. A more confident next step for your classroom and your school.</p>

            <div className="lb-login-illustration" aria-hidden="true">
              <div className="lb-login-orbit lb-login-orbit-outer" />
              <div className="lb-login-orbit lb-login-orbit-inner" />
              <div className="lb-login-orbit-path" />
              <div className="lb-login-shield"><ShieldCheck size={70} strokeWidth={1.2} /></div>
              <span className="lb-login-satellite lb-login-satellite-chart"><BarChart3 size={21} /></span>
              <span className="lb-login-satellite lb-login-satellite-users"><Users size={20} /></span>
              <span className="lb-login-satellite lb-login-satellite-learn"><GraduationCap size={23} /></span>
              <span className="lb-login-orbit-dot" />
              <div className="lb-login-insight"><span><Check size={15} /></span><div>Small insights. Meaningful progress.<small>Every learner’s journey matters.</small></div></div>
            </div>

            <div className="lb-login-story-footer"><GraduationCap size={18} aria-hidden="true" /><span>Built for teachers and school heads.</span></div>
          </aside>

          <section className="lb-login-form-panel" aria-labelledby="login-title">
            <span className="lb-login-form-icon"><LockKeyhole size={21} aria-hidden="true" /></span>
            <span className="lb-login-eyebrow">YOUR LEVELBLUE CONSOLE</span>
            <h1 id="login-title">Welcome back.</h1>
            <p className="lb-login-intro">Sign in to see how learning is moving forward.</p>

            <form onSubmit={handleSubmit} aria-busy={loading}>
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
              <p className="lb-login-role-hint"><ShieldCheck size={15} aria-hidden="true" />Your account opens the right console for your role.</p>
            </form>

            <div className="lb-login-help"><span>Need help signing in?</span><p>Use the account provided by your school. For access or password assistance, contact your school administrator.</p></div>
          </section>
        </div>
        <p className="lb-login-bottom-note"><LockKeyhole size={12} aria-hidden="true" />A dedicated space for your school’s learning insights.</p>
      </main>
      <footer className="lb-login-footer"><span>LEVELBLUE · Cybersecurity awareness</span><span>Building awareness. Empowering educators.</span></footer>
    </div>
  );
}
