import { useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from "recharts";
import {
  Shield, AlertTriangle, ChevronRight, Mail, Lock, Eye, EyeOff,
  ShieldCheck, GraduationCap as GradCapIcon,
} from "lucide-react";
import FontImports from "../components/FontImports";
import { useEffect } from "react";
import { COLORS } from "../constants/colors";

const defaultRadar = [
  { skill: "Phishing", mastery: 0, target: 70 },
  { skill: "Smishing", mastery: 0, target: 70 },
  { skill: "Vishing", mastery: 0, target: 70 },
  { skill: "Pretexting", mastery: 0, target: 70 },
  { skill: "Baiting", mastery: 0, target: 70 },
];

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [classMasteryRadar, setClassMasteryRadar] = useState(defaultRadar);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => {
        if (res.ok) return res.json();
        throw new Error("Failed to load analytics preview");
      })
      .then((data) => {
        if (data.classMasteryRadar) {
          setClassMasteryRadar(data.classMasteryRadar);
        }
      })
      .catch((err) => console.error("Error loading login preview radar:", err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!email.trim() || !password.trim()) {
      setError("Enter both an email and a password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Login failed");
      }

      onLogin(data.role);
    } catch (err) {
      setError(err.message || "Email or password is incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: COLORS.bg, color: COLORS.text,
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      overflow: "hidden", fontFamily: "Inter, sans-serif",
    }}>
      <FontImports />

      <div style={{
        position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none",
        backgroundImage: `radial-gradient(circle at 20% 20%, rgba(61,214,196,0.10), transparent 40%),
                           radial-gradient(circle at 85% 75%, rgba(242,169,59,0.08), transparent 40%)`,
      }} />
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, opacity: 0.06, pointerEvents: "none" }}>
        <defs>
          <pattern id="grid" width="42" height="42" patternUnits="userSpaceOnUse">
            <path d="M 42 0 L 0 0 0 42" fill="none" stroke={COLORS.teal} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 920,
        display: "grid", gridTemplateColumns: "1.1fr 1fr", borderRadius: 20,
        overflow: "hidden", border: `1px solid ${COLORS.border}`, background: COLORS.panel,
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)",
      }}>
        <div style={{
          background: `linear-gradient(160deg, #0D1830 0%, #0B1220 70%)`,
          padding: "44px 38px", display: "flex", flexDirection: "column", justifyContent: "space-between",
          borderRight: `1px solid ${COLORS.border}`,
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 38 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg, ${COLORS.teal}, #2178C2)`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <Shield size={20} color="#0B1220" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: -0.2 }}>LevelBlue</div>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10.5, color: COLORS.sub, letterSpacing: 0.6 }}>ANALYTICS CONSOLE</div>
              </div>
            </div>

            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 600, lineHeight: 1.25, margin: "0 0 14px", letterSpacing: -0.3 }}>
              Track how WMSU-ILS<br />learns to spot a threat.
            </h2>
            <p style={{ fontFamily: "Inter, sans-serif", fontSize: 13.5, color: COLORS.sub, lineHeight: 1.6, maxWidth: 340 }}>
              Sign in to monitor mastery, review pre/post-test gains, and keep your social engineering awareness training on track.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <ResponsiveContainer width="100%" height={170}>
              <RadarChart data={classMasteryRadar} outerRadius={68}>
                <PolarGrid stroke={COLORS.border} />
                <PolarAngleAxis dataKey="skill" tick={{ fill: COLORS.sub, fontSize: 10.5, fontFamily: "Inter" }} />
                <Radar dataKey="mastery" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.3} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: COLORS.sub, textAlign: "center", marginTop: -6 }}>
              LIVE SKILL MASTERY SNAPSHOT
            </div>
          </div>
        </div>

        <div style={{ padding: "44px 40px", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "Inter", fontSize: 12.5, color: COLORS.sub, marginBottom: 26 }}>
            Sign in to your account — your role is detected automatically.
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 7 }}>Email</label>
              <div style={{ display: "flex", alignItems: "center", gap: 9, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "11px 13px" }}>
                <Mail size={15} color={COLORS.sub} />
                <input
                  type="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }}
                  placeholder="you@wmsu.edu.ph"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 7 }}>Password</label>
              <div style={{ display: "flex", alignItems: "center", gap: 9, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "11px 13px" }}>
                <Lock size={15} color={COLORS.sub} />
                <input
                  type={showPw ? "text" : "password"} value={password} onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••••"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }}
                />
                <button type="button" onClick={() => setShowPw(s => !s)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex" }}>
                  {showPw ? <EyeOff size={15} color={COLORS.sub} /> : <Eye size={15} color={COLORS.sub} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, background: "rgba(239,91,91,0.1)",
                border: `1px solid rgba(239,91,91,0.3)`, borderRadius: 9, padding: "9px 12px",
              }}>
                <AlertTriangle size={14} color={COLORS.coral} />
                <span style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.coral }}>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              onClick={(e) => { if (e.currentTarget.form) return; handleSubmit(e); }}
              style={{
                marginTop: 4, background: COLORS.teal, color: "#0B1220", border: "none", borderRadius: 10,
                padding: "12px 0", fontFamily: "Inter", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.75 : 1, transition: "opacity 0.15s", width: "100%",
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
