import { useState, useEffect } from "react";
import { Plus, Trash2, X, GraduationCap, BookOpen, Calendar, HelpCircle } from "lucide-react";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

const inputStyle = {
  width: "100%", padding: "10px 12px", background: COLORS.panelAlt,
  border: `1px solid ${COLORS.border}`, borderRadius: 8,
  color: COLORS.text, fontSize: 13, outline: "none", fontFamily: "Inter"
};

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: COLORS.sub,
  display: "block", marginBottom: 5
};

export default function SectionsManagement() {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSections = (silent = false) => {
    if (!silent) setLoading(true);
    apiFetch("/api/sections")
      .then((res) => res.json())
      .then((data) => setSections(data || []))
      .catch((err) => console.error("Error loading sections:", err))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchSections();
    const interval = setInterval(() => fetchSections(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateSection = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Section name is required");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const res = await apiFetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          subject: subject.trim() || "General Cybersecurity"
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create section");
      }

      setName("");
      setSubject("");
      setShowCreateModal(false);
      fetchSections();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSection = async (id) => {
    if (!window.confirm("Are you sure you want to delete this section? This action is permanent.")) return;
    try {
      const res = await apiFetch(`/api/sections/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        fetchSections();
      } else {
        alert(data.error || "Failed to delete section");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <Panel title="Sections & Subjects Management" sub="Manage class sections and associate them with instructional subjects."
        right={
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: COLORS.teal, color: "#0B1220",
              border: "none", borderRadius: 9, padding: "8px 14px", fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, cursor: "pointer"
            }}
          >
            <Plus size={14} /> Add Section/Subject
          </button>
        }>

        {loading && sections.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter", color: COLORS.sub }}>
            Loading sections and subjects...
          </div>
        ) : sections.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter", color: COLORS.sub }}>
            No sections found. Create one using the button above.
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {sections.map((sec) => (
              <div key={sec.id} style={{
                background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: 18,
                display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14,
                position: "relative"
              }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(61,214,196,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <GraduationCap size={16} color={COLORS.teal} />
                    </div>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 15, color: COLORS.text }}>
                      {sec.name}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: COLORS.sub, marginBottom: 6 }}>
                    <BookOpen size={13} />
                    <span>Subject: <strong>{sec.subject}</strong></span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: COLORS.sub }}>
                    <Calendar size={13} />
                    <span>Created: {new Date(sec.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                  <button
                    onClick={() => handleDeleteSection(sec.id)}
                    style={{
                      background: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                      color: COLORS.coral, fontSize: 12.5, fontFamily: "Inter", fontWeight: 600
                    }}
                  >
                    <Trash2 size={13} /> Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* Create Section Modal */}
      {showCreateModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(11, 18, 32, 0.75)", backdropFilter: "blur(4px)", fontFamily: "Inter, sans-serif"
        }}>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
            width: "100%", maxWidth: 440, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Section/Subject</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.sub }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSection} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>Section Name *</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Grade 10 - Gold"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Subject / Course Area</label>
                <input
                  type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Cybersecurity Awareness"
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
                  {submitting ? "Adding..." : "Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
