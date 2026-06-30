import { useState, useEffect } from "react";
import { Search, Plus, Trash2, X } from "lucide-react";
import Panel from "../../components/Panel";
import StatusPill from "../../components/StatusPill";
import MiniRadar from "../../components/MiniRadar";
import { COLORS } from "../../constants/colors";

export default function ClassRoster() {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [newName, setNewName] = useState("");
  const [newSection, setNewSection] = useState("Grade 10 - Diamond");
  const [newPre, setNewPre] = useState("");
  const [newPost, setNewPost] = useState("");
  const [newSessions, setNewSessions] = useState("");
  const [newPoints, setNewPoints] = useState("");
  const [newTechnical, setNewTechnical] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchStudents = () => {
    setLoading(true);
    fetch("/api/students")
      .then((res) => res.json())
      .then((data) => setStudents(data || []))
      .catch((err) => console.error("Error loading roster:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!newName.trim() || !newSection) {
      setFormError("Student name is required.");
      return;
    }

    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          section: newSection,
          pre: newPre ? Number(newPre) : undefined,
          post: newPost ? Number(newPost) : undefined,
          sessions: newSessions ? Number(newSessions) : undefined,
          points: newPoints ? Number(newPoints) : undefined,
          technical: newTechnical,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add student");
      }

      // Reset form
      setNewName("");
      setNewSection("Grade 10 - Diamond");
      setNewPre("");
      setNewPost("");
      setNewSessions("");
      setNewPoints("");
      setNewTechnical(false);
      setFormError("");
      setShowAddModal(false);

      // Refresh list
      fetchStudents();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Are you sure you want to remove this student?")) return;
    try {
      const res = await fetch(`/api/students/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchStudents();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to delete student");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
  const totalStudents = students.length;
  const sections = [...new Set(students.map((s) => s.section))];

  return (
    <>
      <Panel title="Class Roster" sub={`${totalStudents} students across ${sections.length || 0} sections`}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "7px 12px" }}>
              <Search size={14} color={COLORS.sub} />
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students..."
                style={{ background: "transparent", border: "none", outline: "none", color: COLORS.text, fontFamily: "Inter", fontSize: 12.5, width: 140 }} />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, background: COLORS.teal, color: "#0B1220",
                border: "none", borderRadius: 9, padding: "8px 14px", fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, cursor: "pointer"
              }}
            >
              <Plus size={14} /> Add Student
            </button>
          </div>
        }>
        
        {loading && students.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter", color: COLORS.sub }}>
            Loading student roster...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter", color: COLORS.sub }}>
            {query ? "No students match your search." : "No students in the roster. Add one using the button above."}
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr 0.4fr", gap: 8, padding: "0 12px 10px", fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: COLORS.sub, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}` }}>
              <div>Student</div><div>Section</div><div>Mastery</div><div>Skill Radar</div><div>Pre→Post</div><div>Sessions</div><div>Points</div><div>Status</div><div></div>
            </div>
            {filtered.map(s => {
              const avg = Math.round(Object.values(s.mastery).reduce((a, b) => a + b, 0) / 5 * 100);
              return (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1fr 0.8fr 0.8fr 0.8fr 0.4fr", gap: 8, alignItems: "center", padding: "11px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: COLORS.text }}>
                    {s.name}
                    {s.technical && <span style={{ marginLeft: 6, fontSize: 9, color: COLORS.teal, fontWeight: 700, background: "rgba(61,214,196,0.12)", padding: "2px 5px", borderRadius: 4 }}>TECH</span>}
                  </div>
                  <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }}>{s.section.includes(" - ") ? s.section.split(" - ")[1] : s.section}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: avg >= 70 ? COLORS.teal : avg >= 50 ? COLORS.amber : COLORS.coral }}>{avg}%</div>
                  <MiniRadar data={s.mastery} />
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{s.pre} → <span style={{ color: COLORS.text, fontWeight: 700 }}>{s.post}</span></div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{s.sessions}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>{s.points.toLocaleString()}</div>
                  <StatusPill status={s.status} />
                  <button onClick={() => handleDeleteStudent(s.id)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", padding: 4 }}>
                    <Trash2 size={14} color={COLORS.coral} style={{ opacity: 0.7 }} />
                  </button>
                </div>
              );
            })}
          </>
        )}
      </Panel>

      {/* Add Student Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(11, 18, 32, 0.75)", backdropFilter: "blur(4px)", fontFamily: "Inter, sans-serif"
        }}>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
            width: "100%", maxWidth: 460, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Student</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.sub }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddStudent} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Student Name *</label>
                <input
                  type="text" value={newName} onChange={e => setNewName(e.target.value)} required placeholder="e.g. John Doe"
                  style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Section *</label>
                <select
                  value={newSection} onChange={e => setNewSection(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                >
                  <option value="Grade 10 - Diamond">Grade 10 - Diamond</option>
                  <option value="Grade 10 - Sapphire">Grade 10 - Sapphire</option>
                  <option value="Grade 10 - Emerald">Grade 10 - Emerald</option>
                  <option value="Grade 10 - Topaz">Grade 10 - Topaz</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Pre-Test Score</label>
                  <input
                    type="number" min="0" max="100" value={newPre} onChange={e => setNewPre(e.target.value)} placeholder="Auto-generated if blank"
                    style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Post-Test Score</label>
                  <input
                    type="number" min="0" max="100" value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="Auto-generated if blank"
                    style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Sessions Completed</label>
                  <input
                    type="number" min="0" value={newSessions} onChange={e => setNewSessions(e.target.value)} placeholder="e.g. 5"
                    style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Total Points</label>
                  <input
                    type="number" min="0" value={newPoints} onChange={e => setNewPoints(e.target.value)} placeholder="e.g. 850"
                    style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0" }}>
                <input
                  type="checkbox" id="tech-user" checked={newTechnical} onChange={e => setNewTechnical(e.target.checked)}
                  style={{ cursor: "pointer" }}
                />
                <label htmlFor="tech-user" style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.text, cursor: "pointer" }}>Technical User background</label>
              </div>

              {formError && (
                <div style={{ color: COLORS.coral, fontSize: 12, fontWeight: 600, textAlign: "center" }}>{formError}</div>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button" onClick={() => setShowAddModal(false)}
                  style={{ flex: 1, padding: "10px 0", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ flex: 1, padding: "10px 0", background: COLORS.teal, border: "none", borderRadius: 8, color: "#0B1220", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
                >
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
