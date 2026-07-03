import { useState, useEffect } from "react";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

export default function UsabilityFeedback() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [q1, setQ1] = useState(5);
  const [q2, setQ2] = useState(5);
  const [q3, setQ3] = useState(5);
  const [q4, setQ4] = useState(5);
  const [q5, setQ5] = useState(5);
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchFeedback = (silent = false) => {
    if (!silent) setLoading(true);
    apiFetch("/api/usability-feedback")
      .then((res) => res.json())
      .then((data) => setSubmissions(data || []))
      .catch((err) => console.error("Error loading usability data:", err))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchFeedback();
    const interval = setInterval(() => fetchFeedback(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    const averageRating = Number(((q1 + q2 + q3 + q4 + q5) / 5).toFixed(1));

    try {
      const res = await apiFetch("/api/usability-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherName: "John Lloyd Climaco", // Simulated logged in teacher
          rating: averageRating,
          comments,
          q1, q2, q3, q4, q5
        }),
      });

      if (res.ok) {
        setSubmitted(true);
        setComments("");
        fetchFeedback();
      } else {
        alert("Failed to submit feedback");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Define the questions
  const questions = [
    { key: "q1", q: "The game was easy to navigate" },
    { key: "q2", q: "I understood why my answers were wrong" },
    { key: "q3", q: "The difficulty felt right for me" },
    { key: "q4", q: "I would recommend this to a classmate" },
    { key: "q5", q: "The quizzes felt relevant to real scams" },
  ];

  // Compute averages dynamically
  const computedMeans = questions.map((item) => {
    if (submissions.length === 0) {
      return { q: item.q, mean: 0 };
    }
    const sum = submissions.reduce((acc, sub) => acc + (sub[item.key] || 0), 0);
    const mean = Number((sum / submissions.length).toFixed(1));
    return { q: item.q, mean };
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20, fontFamily: "Inter, sans-serif" }}>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Panel title="Usability & Acceptance Survey" sub={`Weighted mean scores, 5-point scale (n = ${submissions.length} responses)`}>
          {loading ? (
            <div style={{ color: COLORS.sub, padding: "20px 0", textAlign: "center" }}>Loading survey results...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {computedMeans.map((it, i) => (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>{it.q}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: COLORS.teal }}>
                      {it.mean > 0 ? it.mean.toFixed(1) : "N/A"}
                    </span>
                  </div>
                  <div style={{ height: 8, background: COLORS.panelAlt, borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      width: `${it.mean > 0 ? (it.mean / 5) * 100 : 0}%`,
                      height: "100%",
                      background: `linear-gradient(90deg, ${COLORS.teal2}, ${COLORS.teal})`,
                      borderRadius: 5,
                      transition: "width 0.5s ease-out"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent Feedback & Comments" sub="Written opinions from teachers and reviewers">
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 220, overflowY: "auto" }}>
            {loading ? (
              <div style={{ color: COLORS.sub, textAlign: "center" }}>Loading feedback...</div>
            ) : submissions.filter(s => s.comments).length === 0 ? (
              <div style={{ color: COLORS.sub, fontSize: 12.5, textAlign: "center", padding: "10px 0" }}>No comments submitted yet.</div>
            ) : (
              submissions.filter(s => s.comments).map((sub) => (
                <div key={sub.id} style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.teal }}>{sub.teacherName}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: COLORS.sub }}>
                      {new Date(sub.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: COLORS.text, margin: 0, lineHeight: 1.5 }}>"{sub.comments}"</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Submit Survey Response" sub="Rate the system's usability based on your testing session">
        {submitted ? (
          <div style={{ textAlign: "center", padding: "30px 10px" }}>
            <h4 style={{ color: COLORS.teal, fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>Survey Submitted!</h4>
            <p style={{ color: COLORS.sub, fontSize: 12.5, lineHeight: 1.6, margin: "0 0 20px" }}>
              Thank you for contributing to LevelBlue's system usability scale. Your scores have been aggregated into the metrics console.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "8px 16px", color: COLORS.text, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
            >
              Submit Another Response
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            
            {questions.map((item, idx) => {
              const currentVal = [q1, q2, q3, q4, q5][idx];
              const setVal = [setQ1, setQ2, setQ3, setQ4, setQ5][idx];

              return (
                <div key={item.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.sub }}>{idx + 1}. {item.q}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val} type="button" onClick={() => setVal(val)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                          fontFamily: "'JetBrains Mono', monospace", border: `1px solid ${currentVal === val ? COLORS.teal : COLORS.border}`,
                          background: currentVal === val ? "rgba(61,214,196,0.12)" : COLORS.panelAlt,
                          color: currentVal === val ? COLORS.teal : COLORS.sub,
                          transition: "all 0.15s"
                        }}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Comments / Feedback</label>
              <textarea
                value={comments} onChange={(e) => setComments(e.target.value)} rows={3} placeholder="Write any usability suggestions or notes..."
                style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none", resize: "none", fontFamily: "Inter" }}
              />
            </div>

            <button
              type="submit" disabled={submitting}
              style={{
                marginTop: 6, background: COLORS.teal, border: "none", borderRadius: 8, color: "#0B1220",
                padding: "10px 0", fontWeight: 700, fontSize: 13.5, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1
              }}
            >
              {submitting ? "Submitting..." : "Submit Response"}
            </button>

          </form>
        )}
      </Panel>

    </div>
  );
}
