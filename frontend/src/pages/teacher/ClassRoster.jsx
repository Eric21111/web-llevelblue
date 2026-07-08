import { useState, useEffect } from "react";
import { Search, Plus, Trash2, X, Copy, CheckCircle, UserPlus, UserMinus, Eye } from "lucide-react";
import Panel from "../../components/Panel";
import StatusPill from "../../components/StatusPill";
import MiniRadar from "../../components/MiniRadar";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

export default function ClassRoster() {
  const [students, setStudents] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [newSection, setNewSection] = useState("");
  const [email, setEmail] = useState("");
  const [newTechnical, setNewTechnical] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Dynamic sections list
  const [sectionsList, setSectionsList] = useState([]);

  // Password generation states
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [showGeneratedPasswordModal, setShowGeneratedPasswordModal] = useState(false);

  // Mentor assignment states
  const [showMentorModal, setShowMentorModal] = useState(false);
  const [mentorList, setMentorList] = useState([]);
  const [mentorError, setMentorError] = useState("");
  const [mentoringStudent, setMentoringStudent] = useState(null);
  const [mentorLoading, setMentorLoading] = useState(false);
  const [assignedMentors, setAssignedMentors] = useState({});
  const [toastMessage, setToastMessage] = useState("");

  // View mentorship details modal state
  const [showViewMentorModal, setShowViewMentorModal] = useState(false);
  const [viewingBounty, setViewingBounty] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 4000);
  };

  const fetchStudents = (silent = false) => {
    if (!silent) setLoading(true);
    apiFetch("/api/students")
      .then((res) => res.json())
      .then((data) => setStudents(data || []))
      .catch((err) => console.error("Error loading roster:", err))
      .finally(() => { if (!silent) setLoading(false); });
  };

  const fetchBounties = () => {
    apiFetch("/api/bounties")
      .then((res) => res.json())
      .then((data) => {
        const mapping = {};
        if (Array.isArray(data)) {
          data.forEach((b) => {
            if (b.status === "PENDING" || b.status === "AWAITING_LINK" || b.status === "ACCEPTED") {
              mapping[b.mentee_id] = b;
            }
          });
        }
        setAssignedMentors(mapping);
      })
      .catch((err) => console.error("Error loading bounties:", err));
  };

  useEffect(() => {
    fetchStudents();
    fetchBounties();
    const interval = setInterval(() => {
      fetchStudents(true);
      fetchBounties();
    }, 5000);

    // Fetch dynamic sections
    apiFetch("/api/sections")
      .then((res) => res.json())
      .then((data) => {
        setSectionsList(data || []);
        if (data && data.length > 0) {
          setNewSection(data[0].name);
        }
      })
      .catch((err) => console.error("Error loading sections:", err));

    return () => clearInterval(interval);
  }, []);

  const handleAddStudent = async (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !newSection) {
      setFormError("First name, last name, email, and section are required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      const res = await apiFetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          middleName: middleName.trim(),
          email: email.trim(),
          section: newSection,
          technical: newTechnical,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add student");
      }

      // Reset form fields
      setFirstName("");
      setLastName("");
      setMiddleName("");
      setEmail("");
      setNewTechnical(false);
      setFormError("");
      setShowAddModal(false);

      if (data.generatedPassword) {
        setGeneratedPassword(data.generatedPassword);
        setShowGeneratedPasswordModal(true);
      }

      // Refresh list
      fetchStudents();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteStudent = async (id) => {
    if (!window.confirm("Are you sure you want to remove this student?")) return;
    try {
      const res = await apiFetch(`/api/students/${id}`, {
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

  const handleAssignMentor = async (student) => {
    setMentoringStudent(student);
    setShowMentorModal(true);
    setMentorLoading(true);
    setMentorError("");
    setMentorList([]);
    
    try {
      const res = await apiFetch(`/api/students/${student._id || student.id}/mentors`);
      const data = await res.json();
      
      if (!res.ok) {
        setMentorError(data.error || "Failed to fetch mentors.");
      } else {
        setMentorList(data.mentors || []);
      }
    } catch (err) {
      setMentorError(err.message || "An error occurred.");
    } finally {
      setMentorLoading(false);
    }
  };

  const handleCancelMentorship = async (studentId) => {
    const bounty = assignedMentors[studentId];
    if (!bounty) return;
    if (!window.confirm("Are you sure you want to cancel the mentorship for this student?")) return;

    try {
      const res = await apiFetch(`/api/bounties/${bounty.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAssignedMentors((prev) => {
          const next = { ...prev };
          delete next[studentId];
          return next;
        });
        showToast("SUCCESS: Mentorship cancelled successfully.");
      } else {
        alert("Failed to cancel mentorship.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to cancel mentorship. Check connection.");
    }
  };

  const handleViewMentorship = (studentId) => {
    const bounty = assignedMentors[studentId];
    if (bounty) {
      setViewingBounty(bounty);
      setShowViewMentorModal(true);
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
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1fr 0.8fr 0.8fr 0.9fr 0.8fr 0.6fr", gap: 8, padding: "0 12px 10px", fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: COLORS.sub, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}` }}>
              <div>Student</div><div>Section</div><div>Mastery</div><div>Skill Radar</div><div>Pre→Post</div><div>Sessions</div><div>Points</div><div>BKT P(L)</div><div>Status</div><div></div>
            </div>
            {filtered.map(s => {
              const avg = Math.round(Object.values(s.mastery).reduce((a, b) => a + b, 0) / 5 * 100);
              return (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.8fr 1.2fr 1fr 0.8fr 0.8fr 0.9fr 0.8fr 0.6fr", gap: 8, alignItems: "center", padding: "11px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: COLORS.text, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    {s.name}
                    {s.technical && <span style={{ fontSize: 9, color: COLORS.teal, fontWeight: 700, background: "rgba(61,214,196,0.12)", padding: "2px 5px", borderRadius: 4 }}>TECH</span>}
                    {assignedMentors[s._id || s.id] && (
                      <span style={{ fontSize: 9, color: COLORS.amber, fontWeight: 700, background: "rgba(242,169,59,0.12)", padding: "2px 6px", borderRadius: 12, border: `1px solid ${COLORS.amber}40`, display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ width: 4, height: 4, borderRadius: "50%", background: COLORS.amber, display: "inline-block" }}></span>
                        MENTOR PENDING
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }}>{s.section.includes(" - ") ? s.section.split(" - ")[1] : s.section}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: avg >= 70 ? COLORS.teal : avg >= 50 ? COLORS.amber : COLORS.coral }}>{avg}%</div>
                  <MiniRadar data={s.mastery} />
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{s.pre} → <span style={{ color: COLORS.text, fontWeight: 700 }}>{s.post}</span></div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{s.sessions}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>{s.points.toLocaleString()}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700,
                      color: (s.bkt ?? avg / 100) < 0.40 ? COLORS.coral : (s.bkt ?? avg / 100) < 0.70 ? COLORS.amber : COLORS.teal
                    }}>
                      {typeof s.bkt === "number" ? s.bkt.toFixed(3) : (avg / 100).toFixed(3)}
                    </span>
                    <span style={{ fontSize: 9, fontFamily: "Inter", color: COLORS.sub, letterSpacing: 0.3 }}>P(L)</span>
                  </div>
                  <StatusPill status={s.status} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                    {assignedMentors[s._id || s.id] ? (
                      assignedMentors[s._id || s.id].status === "ACCEPTED" ? (
                        <button 
                          onClick={() => handleViewMentorship(s._id || s.id)} 
                          title="View Mentorship" 
                          style={{ background: "rgba(61,214,196,0.12)", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", padding: 6, borderRadius: 6 }}
                        >
                          <Eye size={14} color={COLORS.teal} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleCancelMentorship(s._id || s.id)} 
                          title="Cancel Mentorship" 
                          style={{ background: "rgba(239,91,91,0.12)", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", padding: 6, borderRadius: 6 }}
                        >
                          <UserMinus size={14} color={COLORS.coral} />
                        </button>
                      )
                    ) : (
                      s.status === "At-Risk" && (
                        <button onClick={() => handleAssignMentor(s)} title="Assign Peer Mentor" style={{ background: "rgba(61,214,196,0.12)", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", padding: 6, borderRadius: 6 }}>
                          <UserPlus size={14} color={COLORS.teal} />
                        </button>
                      )
                    )}
                    <button onClick={() => handleDeleteStudent(s.id)} style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", justifyContent: "center", padding: 6 }}>
                      <Trash2 size={14} color={COLORS.coral} style={{ opacity: 0.7 }} />
                    </button>
                  </div>
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
            width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>Add New Student</h3>
              <button onClick={() => setShowAddModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.sub }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddStudent} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Name Row: First Name, Middle Name, Last Name */}
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1.2fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>First Name *</label>
                  <input
                    type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="e.g. John"
                    style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Middle Name</label>
                  <input
                    type="text" value={middleName} onChange={e => setMiddleName(e.target.value)} placeholder="e.g. Smith"
                    style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Last Name *</label>
                  <input
                    type="text" value={lastName} onChange={e => setLastName(e.target.value)} required placeholder="e.g. Doe"
                    style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Email Address *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="e.g. john.doe@wmsu.edu.ph"
                  style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Section *</label>
                <select
                  value={newSection} onChange={e => setNewSection(e.target.value)} required
                  style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                >
                  <option value="">Select Section</option>
                  {sectionsList.map((sec) => (
                    <option key={sec.id} value={sec.name}>{sec.name}</option>
                  ))}
                </select>
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
                  type="submit" disabled={submitting}
                  style={{ flex: 1, padding: "10px 0", background: COLORS.teal, border: "none", borderRadius: 8, color: "#0B1220", fontWeight: 700, fontSize: 13.5, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Adding..." : "Add Student"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generated Password Modal */}
      {showGeneratedPasswordModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(11, 18, 32, 0.75)", backdropFilter: "blur(4px)", fontFamily: "Inter, sans-serif"
        }}>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
            width: "100%", maxWidth: 460, padding: 28, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(61,214,196,0.12)", border: "1px solid rgba(61,214,196,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <CheckCircle size={24} color={COLORS.teal} />
              </div>
            </div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: "0 0 8px 0", color: COLORS.teal, textAlign: "center" }}>
              Account Created Successfully
            </h3>
            <p style={{ fontFamily: "Inter", fontSize: 13.5, color: COLORS.sub, marginBottom: 20, lineHeight: 1.6, textAlign: "center" }}>
              Share this temporary password with the student. They will use this password to log in to the mobile game.
            </p>
            <div style={{
              background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 12
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: 3 }}>
                {generatedPassword}
              </span>
              <button
                onClick={() => { navigator.clipboard.writeText(generatedPassword); }}
                title="Copy to clipboard"
                style={{ background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 7, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: COLORS.sub, fontFamily: "Inter", fontSize: 12 }}
              >
                <Copy size={14} /> Copy
              </button>
            </div>
            <button
              onClick={() => setShowGeneratedPasswordModal(false)}
              style={{ width: "100%", padding: "12px 0", background: COLORS.teal, border: "none", borderRadius: 8, color: "#0B1220", fontWeight: 700, fontSize: 13.5, cursor: "pointer" }}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {/* Mentor Assignment Modal */}
      {showMentorModal && mentoringStudent && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(11, 18, 32, 0.75)", backdropFilter: "blur(4px)", fontFamily: "Inter, sans-serif"
        }}>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
            width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <UserPlus size={20} color={COLORS.teal} />
                Assign Peer Mentor
              </h3>
              <button onClick={() => setShowMentorModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.sub }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <span style={{ color: COLORS.sub, fontSize: 13 }}>Finding eligible mentors for: </span>
              <strong style={{ color: COLORS.text, fontSize: 14 }}>{mentoringStudent.name}</strong>
            </div>

            {mentorLoading ? (
              <div style={{ textAlign: "center", padding: "30px 20px", color: COLORS.sub, fontSize: 13.5 }}>
                Querying BKT records for qualified mentors...
              </div>
            ) : mentorError ? (
              <div style={{ background: "rgba(239,91,91,0.12)", color: COLORS.coral, padding: 16, borderRadius: 8, fontSize: 13.5, border: `1px solid ${COLORS.coral}33`, display: "flex", flexDirection: "column", gap: 6 }}>
                <strong style={{ fontSize: 14 }}>ERROR:</strong> {mentorError}
              </div>
            ) : mentorList.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto", paddingRight: 4 }}>
                {mentorList.map((mentor, idx) => (
                  <div key={mentor.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: COLORS.panelAlt, padding: 14, borderRadius: 10, border: `1px solid ${idx === 0 ? COLORS.teal : COLORS.border}` }}>
                    <div>
                      <div style={{ fontWeight: 600, color: COLORS.text, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
                        {mentor.name}
                        {idx === 0 && <span style={{ background: "rgba(61,214,196,0.15)", color: COLORS.teal, fontSize: 10, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>TOP MATCH</span>}
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.sub, marginTop: 6 }}>
                        <span style={{ color: COLORS.text }}>P(L) &gt; 0.90</span> in: <span style={{ color: COLORS.teal }}>{mentor.topics.join(", ")}</span>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const res = await apiFetch("/api/bounties", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              mentor_id: mentor.id,
                              mentee_id: mentoringStudent.id || mentoringStudent._id,
                              topics: mentor.topics
                            })
                          });
                          if (!res.ok) {
                            const err = await res.json();
                            alert(err.error || "Failed to dispatch bounty");
                            return;
                          }
                          setAssignedMentors(prev => ({ ...prev, [mentoringStudent._id || mentoringStudent.id]: data }));
                          setShowMentorModal(false);
                          showToast("SUCCESS: Bounty dispatched to Mentor's Threat Log.");
                        } catch (err) {
                          alert("Failed to assign mentor. Check connection.");
                        }
                      }}
                      style={{ background: COLORS.teal, color: "#0B1220", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setShowMentorModal(false)}
                style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Mentorship Details Modal */}
      {showViewMentorModal && viewingBounty && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(11, 18, 32, 0.75)", backdropFilter: "blur(4px)", fontFamily: "Inter, sans-serif"
        }}>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
            width: "100%", maxWidth: 450, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: 10, color: COLORS.teal }}>
                <Eye size={20} color={COLORS.teal} />
                Active Mentorship Details
              </h3>
              <button onClick={() => setShowViewMentorModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.sub }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 24 }}>
              <div>
                <span style={{ fontSize: 12, color: COLORS.sub }}>MENTEE</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{viewingBounty.mentee?.name}</div>
                <div style={{ fontSize: 12, color: COLORS.sub }}>Section: {viewingBounty.mentee?.section}</div>
              </div>
              
              <div>
                <span style={{ fontSize: 12, color: COLORS.sub }}>ASSIGNED MENTOR</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.teal }}>{viewingBounty.mentor?.name}</div>
                <div style={{ fontSize: 12, color: COLORS.sub }}>Section: {viewingBounty.mentor?.section}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={{ fontSize: 12, color: COLORS.sub }}>TOPIC FOCUS</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{viewingBounty.topic}</div>
                </div>
                <div>
                  <span style={{ fontSize: 12, color: COLORS.sub }}>HANDSHAKE STATUS</span>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.teal }}>
                    Verified
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowViewMentorModal(false)}
                style={{ padding: "10px 18px", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, background: COLORS.teal, color: "#0B1220", 
          padding: "14px 24px", borderRadius: 8, fontWeight: 700, fontSize: 13.5, zIndex: 1000,
          boxShadow: "0 10px 30px rgba(0,0,0,0.3)", fontFamily: "Inter, sans-serif",
          display: "flex", alignItems: "center", gap: 10, animation: "fadeIn 0.3s ease-out"
        }}>
          <CheckCircle size={18} color="#0B1220" />
          {toastMessage}
        </div>
      )}
    </>
  );
}
