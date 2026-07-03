import { useState } from "react";
import { Save, User, Image as ImageIcon, CheckCircle, AlertTriangle, Lock, Eye, EyeOff } from "lucide-react";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

export default function TeacherSettings({ user, setUser }) {
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    middleInitial: user?.middleInitial || "",
    email: user?.email || "",
    imageUrl: user?.imageUrl || "",
  });

  const [passwordData, setPasswordData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: "", text: "" });
  const [passwordMsg, setPasswordMsg] = useState({ type: "", text: "" });

  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [confirmingCode, setConfirmingCode] = useState(false);

  const handleSendCode = async () => {
    if (!profileData.email) return;
    setSendingCode(true);
    setVerifyMsg("");
    try {
      const res = await apiFetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      setIsVerifyingEmail(true);
      if (data.devMode) {
        setVerifyMsg(`Dev mode — code: ${data.code}`);
      }
    } catch (err) {
      setVerifyMsg(err.message);
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmitCode = async () => {
    if (verificationCode.length !== 6) {
      setVerifyMsg("Please enter a valid 6-digit code.");
      return;
    }
    setConfirmingCode(true);
    setVerifyMsg("");
    try {
      const res = await apiFetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileData.email, code: verificationCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      setIsEmailVerified(true);
      setIsVerifyingEmail(false);
      setVerificationCode("");
      setVerifyMsg("");
    } catch (err) {
      setVerifyMsg(err.message);
    } finally {
      setConfirmingCode(false);
    }
  };

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!profileData.email) return;

    setLoadingProfile(true);
    setProfileMsg({ type: "", text: "" });
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user?._id, ...profileData }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      if (setUser) setUser(data);
      setProfileMsg({ type: "success", text: "Profile updated successfully!" });
    } catch (err) {
      setProfileMsg({ type: "error", text: err.message });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!passwordData.password) return;
    if (passwordData.password !== passwordData.confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setLoadingPassword(true);
    setPasswordMsg({ type: "", text: "" });
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user?._id,
          email: user?.email,
          password: passwordData.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");

      setPasswordMsg({ type: "success", text: "Password updated successfully!" });
      setPasswordData({ password: "", confirmPassword: "" });
    } catch (err) {
      setPasswordMsg({ type: "error", text: err.message });
    } finally {
      setLoadingPassword(false);
    }
  };

  const msgBanner = (msg) =>
    msg.text ? (
      <div style={{
        display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 8, marginBottom: 16,
        background: msg.type === "success" ? "rgba(61,214,196,0.1)" : "rgba(239,91,91,0.1)",
        border: `1px solid ${msg.type === "success" ? "rgba(61,214,196,0.3)" : "rgba(239,91,91,0.3)"}`,
      }}>
        {msg.type === "success"
          ? <CheckCircle size={16} color={COLORS.teal} />
          : <AlertTriangle size={16} color={COLORS.coral} />}
        <span style={{ fontSize: 13, color: msg.type === "success" ? COLORS.teal : COLORS.coral, fontFamily: "Inter" }}>
          {msg.text}
        </span>
      </div>
    ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 900 }}>

      {/* Profile Settings */}
      <Panel title="Profile Settings" sub="Update your personal details and avatar" icon={<User size={18} />}>
        {msgBanner(profileMsg)}
        <form onSubmit={handleProfileSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>

          {/* Avatar + Image URL */}
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 20, marginBottom: 8 }}>
            <div style={{
              width: 80, height: 80, borderRadius: "50%", background: COLORS.panelAlt,
              border: `1px solid ${COLORS.border}`, display: "flex", alignItems: "center",
              justifyContent: "center", overflow: "hidden", flexShrink: 0,
            }}>
              {profileData.imageUrl
                ? <img src={profileData.imageUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <User size={32} color={COLORS.sub} />}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 6 }}>Profile Image URL</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "9px 12px" }}>
                <ImageIcon size={14} color={COLORS.sub} />
                <input
                  type="text" name="imageUrl" value={profileData.imageUrl} onChange={handleProfileChange}
                  placeholder="https://example.com/avatar.png"
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }}
                />
              </div>
            </div>
          </div>

          {/* First Name */}
          <div>
            <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 6 }}>First Name</label>
            <input type="text" name="firstName" value={profileData.firstName} onChange={handleProfileChange}
              style={{ width: "100%", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }} />
          </div>

          {/* M.I. + Last Name */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12 }}>
            <div>
              <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 6 }}>M.I.</label>
              <input type="text" name="middleInitial" value={profileData.middleInitial} onChange={handleProfileChange} maxLength={2}
                style={{ width: "100%", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }} />
            </div>
            <div>
              <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 6 }}>Last Name</label>
              <input type="text" name="lastName" value={profileData.lastName} onChange={handleProfileChange}
                style={{ width: "100%", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }} />
            </div>
          </div>

          {/* Email */}
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 6 }}>Email</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="email" name="email" value={profileData.email} onChange={handleProfileChange}
                style={{ flex: 1, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }}
              />
              {isEmailVerified ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(61,214,196,0.12)", border: "1px solid rgba(61,214,196,0.3)", borderRadius: 8, padding: "0 14px", color: COLORS.teal, fontSize: 12.5, fontWeight: 600 }}>
                  ✓ Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sendingCode}
                  style={{ background: "rgba(242,169,59,0.15)", border: `1px solid rgba(242,169,59,0.3)`, borderRadius: 8, padding: "0 16px", color: COLORS.amber, fontSize: 12.5, fontWeight: 600, cursor: sendingCode ? "default" : "pointer", opacity: sendingCode ? 0.7 : 1, transition: "all 0.2s" }}
                >
                  {sendingCode ? "Sending..." : "Verify"}
                </button>
              )}
            </div>

            {isVerifyingEmail && (
              <div style={{ marginTop: 12, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 12 }}>
                <span style={{ fontSize: 12, color: COLORS.amber, fontFamily: "Inter", display: "block", marginBottom: 8, fontWeight: 500 }}>
                  ✉ A 6-digit verification code has been sent to your email address.
                </span>
                {verifyMsg && (
                  <div style={{ fontSize: 12, color: verifyMsg.includes("Dev mode") ? COLORS.teal : COLORS.coral, fontFamily: "Inter", marginBottom: 8 }}>
                    {verifyMsg}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    type="text"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="••••••"
                    style={{ width: 140, background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 10px", color: COLORS.text, fontFamily: "Inter", fontSize: 13, textAlign: "center", letterSpacing: 4, outline: "none" }}
                  />
                  <button
                    type="button"
                    onClick={handleSubmitCode}
                    disabled={confirmingCode}
                    style={{ background: COLORS.teal, border: "none", borderRadius: 8, padding: "0 16px", color: "#0B1220", fontSize: 12.5, fontWeight: 600, cursor: confirmingCode ? "default" : "pointer", opacity: confirmingCode ? 0.7 : 1 }}
                  >
                    {confirmingCode ? "Verifying..." : "Confirm Code"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Save Button */}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button type="submit" disabled={loadingProfile}
              style={{
                display: "flex", alignItems: "center", gap: 8, background: COLORS.teal, color: "#0B1220",
                border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: "Inter", fontWeight: 600, fontSize: 13,
                cursor: loadingProfile ? "default" : "pointer", opacity: loadingProfile ? 0.7 : 1, transition: "opacity 0.2s",
              }}>
              <Save size={16} />
              {loadingProfile ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Panel>

      {/* Password Settings */}
      <Panel title="Security & Password" sub="Update your account password" icon={<Lock size={18} />}>
        {msgBanner(passwordMsg)}
        <form onSubmit={handlePasswordSubmit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 24px" }}>

          {/* New Password */}
          <div>
            <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 6 }}>New Password</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "0 12px 0 0" }}>
              <input
                type={showPassword ? "text" : "password"} name="password" value={passwordData.password}
                onChange={handlePasswordChange} placeholder="••••••••••"
                style={{ flex: 1, background: "transparent", border: "none", outline: "none", padding: "10px 12px", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}>
                {showPassword ? <EyeOff size={15} color={COLORS.sub} /> : <Eye size={15} color={COLORS.sub} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label style={{ fontFamily: "Inter", fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 6 }}>Confirm New Password</label>
            <input
              type="password" name="confirmPassword" value={passwordData.confirmPassword}
              onChange={handlePasswordChange} placeholder="••••••••••"
              style={{ width: "100%", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 12px", color: COLORS.text, fontFamily: "Inter", fontSize: 13.5 }}
            />
          </div>

          {/* Update Button */}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <button type="submit" disabled={loadingPassword}
              style={{
                display: "flex", alignItems: "center", gap: 8, background: COLORS.teal, color: "#0B1220",
                border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: "Inter", fontWeight: 600, fontSize: 13,
                cursor: loadingPassword ? "default" : "pointer", opacity: loadingPassword ? 0.7 : 1, transition: "opacity 0.2s",
              }}>
              <Save size={16} />
              {loadingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </Panel>

    </div>
  );
}
