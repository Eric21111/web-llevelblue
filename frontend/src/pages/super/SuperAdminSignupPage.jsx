import { useState } from "react";
import { Shield, Key, Mail, Lock, User, AlertTriangle, ArrowLeft, CheckCircle2, Eye, EyeOff } from "lucide-react";
import FontImports from "../../components/FontImports";
import PasswordStrengthIndicator, { isPasswordStrong } from "../../components/PasswordStrengthIndicator";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

const inputWrapStyle = {
  display: "flex", alignItems: "center", gap: 9,
  background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`,
  borderRadius: 10, padding: "10px 12px"
};

const inputStyle = {
  flex: 1, background: "transparent", border: "none", outline: "none",
  color: COLORS.text, fontSize: 13, fontFamily: "Inter", width: "100%"
};

const labelStyle = {
  fontSize: 11.5, fontWeight: 600, color: COLORS.sub,
  display: "block", marginBottom: 6
};

export default function SuperAdminSignupPage({ onComplete }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [securityKey, setSecurityKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !securityKey.trim()) {
      setError("First name, last name, email, password, and security key are required.");
      return;
    }

    if (!isPasswordStrong(password)) {
      setError("Password does not meet all strength requirements.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await apiFetch("/api/auth/register-super-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleInitial: middleInitial.trim(),
          email: email.trim(),
          password,
          securityKey: securityKey.trim()
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setSuccess(true);
      setError("");
    } catch (err) {
      setError(err.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  const displayName = `${firstName}${middleInitial ? ` ${middleInitial.toUpperCase()}.` : ""} ${lastName}`.trim();

  return (
    <div style={{
      minHeight: "100vh", width: "100%", background: COLORS.bg, color: COLORS.text,
      display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
      overflow: "hidden", fontFamily: "Inter, sans-serif",
    }}>
      <FontImports />

      <div style={{
        position: "absolute", inset: 0, opacity: 0.5, pointerEvents: "none",
        backgroundImage: `radial-gradient(circle at 15% 15%, rgba(61,214,196,0.08), transparent 45%),
                           radial-gradient(circle at 85% 85%, rgba(239,91,91,0.05), transparent 40%)`,
      }} />

      <div style={{
        position: "relative", zIndex: 1, width: "100%", maxWidth: 480, borderRadius: 20,
        overflow: "hidden", border: `1px solid ${COLORS.border}`, background: COLORS.panel,
        boxShadow: "0 30px 80px -20px rgba(0,0,0,0.6)", padding: "40px 32px"
      }}>
        
        {success ? (
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            <div style={{
              width: 54, height: 54, borderRadius: "50%", background: "rgba(61,214,196,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <CheckCircle2 size={32} color={COLORS.teal} />
            </div>
            <div>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Account Created!</h2>
              <p style={{ fontSize: 13.5, color: COLORS.sub, lineHeight: 1.6, margin: 0 }}>
                The Super Admin (Department Head) account for <strong>{displayName}</strong> was registered in the database.
              </p>
            </div>
            <button
              onClick={onComplete}
              style={{
                marginTop: 10, width: "100%", background: COLORS.teal, color: "#0B1220",
                border: "none", borderRadius: 10, padding: "12px 0", fontFamily: "Inter",
                fontWeight: 700, fontSize: 14, cursor: "pointer"
              }}
            >
              Go to Login
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${COLORS.teal}, #2178C2)`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <Shield size={16} color="#0B1220" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>LevelBlue</div>
                <div style={{ fontFamily: "Inter", fontSize: 9.5, color: COLORS.sub, letterSpacing: 0.5 }}>CREATION PANEL</div>
              </div>
            </div>

            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, margin: "0 0 6px" }}>
              Super Admin Setup
            </h2>
            <p style={{ fontSize: 13, color: COLORS.sub, lineHeight: 1.5, margin: "0 0 24px" }}>
              Create a secure administrator credential to configure teacher credentials and audit institution learning logs.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Name Row: First Name, M.I., Last Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <div style={inputWrapStyle}>
                    <User size={14} color={COLORS.sub} />
                    <input
                      type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="Dahlia"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div style={{ width: 56 }}>
                  <label style={labelStyle}>M.I.</label>
                  <div style={inputWrapStyle}>
                    <input
                      type="text" value={middleInitial} onChange={e => setMiddleInitial(e.target.value.slice(0, 1))} placeholder="A" maxLength={1}
                      style={{ ...inputStyle, textAlign: "center", textTransform: "uppercase" }}
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <div style={inputWrapStyle}>
                    <input
                      type="text" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Reyes"
                      style={inputStyle}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email Address *</label>
                <div style={inputWrapStyle}>
                  <Mail size={14} color={COLORS.sub} />
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="headoffice@wmsu.edu.ph"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Password *</label>
                  <div style={inputWrapStyle}>
                    <Lock size={14} color={COLORS.sub} />
                    <input
                      type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                      style={inputStyle}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                      {showPassword ? <EyeOff size={14} color={COLORS.sub} /> : <Eye size={14} color={COLORS.sub} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Confirm *</label>
                  <div style={inputWrapStyle}>
                    <Lock size={14} color={COLORS.sub} />
                    <input
                      type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="••••••••"
                      style={inputStyle}
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}>
                      {showConfirm ? <EyeOff size={14} color={COLORS.sub} /> : <Eye size={14} color={COLORS.sub} />}
                    </button>
                  </div>
                </div>
              </div>

              <PasswordStrengthIndicator password={password} />

              <div>
                <label style={labelStyle}>Security Key *</label>
                <div style={inputWrapStyle}>
                  <Key size={14} color={COLORS.sub} />
                  <input
                    type="password" value={securityKey} onChange={e => setSecurityKey(e.target.value)} required placeholder="Enter security key"
                    style={inputStyle}
                  />
                </div>
              </div>

              {error && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, background: "rgba(239,91,91,0.08)",
                  border: `1px solid rgba(239,91,91,0.25)`, borderRadius: 9, padding: "9px 12px"
                }}>
                  <AlertTriangle size={14} color={COLORS.coral} />
                  <span style={{ fontSize: 12, color: COLORS.coral, fontWeight: 500 }}>{error}</span>
                </div>
              )}

              <button
                type="submit" disabled={loading}
                style={{
                  marginTop: 6, background: COLORS.teal, color: "#0B1220", border: "none", borderRadius: 10,
                  padding: "12px 0", fontFamily: "Inter", fontWeight: 700, fontSize: 14, cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.75 : 1, transition: "opacity 0.15s", width: "100%"
                }}
              >
                {loading ? "Registering..." : "Create Account"}
              </button>

              <button
                type="button" onClick={onComplete}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "transparent",
                  border: "none", color: COLORS.sub, fontSize: 12.5, cursor: "pointer", marginTop: 8, alignSelf: "center"
                }}
              >
                <ArrowLeft size={13} /> Back to Login
              </button>
            </form>
          </>
        )}

      </div>
    </div>
  );
}
