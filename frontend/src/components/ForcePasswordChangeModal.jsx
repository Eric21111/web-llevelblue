import { useState } from "react";
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import PasswordStrengthIndicator, { isPasswordStrong } from "./PasswordStrengthIndicator";
import { COLORS } from "../constants/colors";
import { apiFetch } from "../utils/api";

const inputStyle = {
  width: "100%", padding: "12px 14px", background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`, borderRadius: 8,
  color: COLORS.text, fontSize: 13.5, outline: "none", fontFamily: "Inter"
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: COLORS.sub,
  display: "block", marginBottom: 6
};

export default function ForcePasswordChangeModal({ user, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setError("Please fill in both fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!isPasswordStrong(password)) {
      setError("Password does not meet all strength requirements.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/api/auth/complete-invite", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user?._id || user?.id, password }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      onComplete(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(11, 18, 32, 0.9)", backdropFilter: "blur(8px)", fontFamily: "Inter, sans-serif"
    }}>
      <div style={{
        background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
        width: "100%", maxWidth: 440, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.6)"
      }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${COLORS.teal}, #2178C2)`,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <Lock size={24} color="#0B1220" />
          </div>
        </div>
        
        <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, margin: "0 0 12px 0", textAlign: "center", color: COLORS.text }}>
          Welcome, {user?.firstName}!
        </h3>
        <p style={{ fontSize: 13.5, color: COLORS.sub, marginBottom: 24, textAlign: "center", lineHeight: 1.5 }}>
          For security reasons, you must change your temporary password before accessing the analytics console.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={labelStyle}>New Password</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "0 12px 0 0" }}>
              <input
                type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                style={{ ...inputStyle, border: "none", background: "transparent" }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
                {showPassword ? <EyeOff size={16} color={COLORS.sub} /> : <Eye size={16} color={COLORS.sub} />}
              </button>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Confirm New Password</label>
            <input
              type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          <PasswordStrengthIndicator password={password} />

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,91,91,0.1)", border: `1px solid rgba(239,91,91,0.3)`, borderRadius: 8, padding: "10px 14px" }}>
              <AlertTriangle size={14} color={COLORS.coral} />
              <span style={{ fontSize: 12.5, color: COLORS.coral }}>{error}</span>
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 8, width: "100%", padding: "14px 0", background: COLORS.teal, border: "none", borderRadius: 8,
              color: "#0B1220", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer", opacity: loading ? 0.7 : 1, transition: "opacity 0.2s"
            }}
          >
            {loading ? "Updating..." : "Set Password & Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
