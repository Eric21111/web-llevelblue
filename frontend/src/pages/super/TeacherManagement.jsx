import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";

const inputStyle = {
  width: "100%", padding: "10px 12px", background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`, borderRadius: 8,
  color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "Inter"
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: COLORS.sub,
  display: "block", marginBottom: 5
};

export default function TeacherManagement() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchTeachers = () => {
    setLoading(true);
    fetch("/api/teachers")
      .then((res) => res.json())
      .then((data) => setTeachers(data || []))
      .catch((err) => console.error("Error loading teachers:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleCreateTeacher = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      setFormError("First name, last name, email, and password are required");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleInitial: middleInitial.trim(),
          email: email.trim(),
          password: password.trim()
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create teacher account");
      }

      setFirstName("");
      setLastName("");
      setMiddleInitial("");
      setEmail("");
      setPassword("");
      setShowCreateModal(false);
      fetchTeachers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeacher = async (id) => {
    if (!window.confirm("Are you sure you want to delete this teacher account? This will also revoke their login access.")) return;
    try {
      const res = await fetch(`/api/teachers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTeachers();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete teacher");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Panel title="Teacher & Admin Accounts" sub="Manage access for teacher (admin) accounts across sections"
        right={
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: COLORS.teal, color: "#0B1220",
              border: "none", borderRadius: 9, padding: "8px 14px", fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, cursor: "pointer"
            }}
          >
            <Plus size={14} /> Create Teacher
          </button>
        }>
        
        {loading && teachers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter", color: COLORS.sub }}>
            Loading teacher accounts...
          </div>
        ) : teachers.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter", color: COLORS.sub }}>
            No teacher accounts found. Create one using the button above.
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 0.4fr", gap: 8, padding: "0 12px 10px", fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: COLORS.sub, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}` }}>
              <div>Name</div><div>Email</div><div>Sections</div><div>Students</div><div>Status</div><div></div>
            </div>
            {teachers.map((t) => (
              <div key={t._id || t.id} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr 0.4fr", gap: 8, alignItems: "center", padding: "12px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.panelAlt, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.teal }}>
                    {(t.firstName?.[0] || "").toUpperCase()}{(t.lastName?.[0] || "").toUpperCase()}
                  </div>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: COLORS.text }}>{t.name}</span>
                </div>
                <div style={{ fontFamily: "Inter", fontSize: 12.5, color: COLORS.sub }}>{t.email}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: COLORS.text }}>{t.sections}</div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: COLORS.text }}>{t.students}</div>
                <span style={{
                  fontFamily: "Inter", fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 20, width: "fit-content",
                  color: t.status === "Active" ? COLORS.teal : COLORS.amber,
                  background: t.status === "Active" ? "rgba(61,214,196,0.12)" : "rgba(242,169,59,0.12)",
                }}>{t.status}</span>
                <button onClick={() => handleDeleteTeacher(t._id || t.id)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", padding: 4 }}>
                  <Trash2 size={14} color={COLORS.coral} style={{ opacity: 0.7 }} />
                </button>
              </div>
            ))}
          </>
        )}
      </Panel>

      {/* Create Teacher Modal */}
      {showCreateModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(11, 18, 32, 0.75)", backdropFilter: "blur(4px)", fontFamily: "Inter, sans-serif"
        }}>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
            width: "100%", maxWidth: 460, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>Create Teacher Account</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.sub }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTeacher} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Name Row: First Name, M.I., Last Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input
                    type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="John"
                    style={inputStyle}
                  />
                </div>
                <div style={{ width: 52 }}>
                  <label style={labelStyle}>M.I.</label>
                  <input
                    type="text" value={middleInitial} onChange={e => setMiddleInitial(e.target.value.slice(0, 1))} placeholder="L" maxLength={1}
                    style={{ ...inputStyle, textAlign: "center", textTransform: "uppercase" }}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input
                    type="text" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="Doe"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Email Address *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="j.doe@wmsu.edu.ph"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Password *</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                  style={inputStyle}
                />
              </div>

              {formError && (
                <div style={{ color: COLORS.coral, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{formError}</div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button" onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, padding: "10px 0", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={submitting}
                  style={{ flex: 1, padding: "10px 0", background: COLORS.teal, border: "none", borderRadius: 8, color: "#0B1220", fontWeight: 700, fontSize: 13.5, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
