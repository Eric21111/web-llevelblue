import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Plus, X } from "lucide-react";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

export default function ContentBankManagement() {
  const [contentBank, setContentBank] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Form states
  const [selectedSkill, setSelectedSkill] = useState("Phishing");
  const [addAuthored, setAddAuthored] = useState("");
  const [addValidated, setAddValidated] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchContentBank = (silent = false) => {
    if (!silent) setLoading(true);
    apiFetch("/api/content-bank")
      .then((res) => res.json())
      .then((data) => setContentBank(data || []))
      .catch((err) => console.error("Error loading content bank:", err))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchContentBank();
    const interval = setInterval(() => fetchContentBank(true), 5000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateContent = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await apiFetch("/api/content-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skill: selectedSkill,
          authored: addAuthored ? Number(addAuthored) : 0,
          validated: addValidated ? Number(addValidated) : 0,
        }),
      });

      if (res.ok) {
        setAddAuthored("");
        setAddValidated("");
        setShowUpdateModal(false);
        fetchContentBank();
      } else {
        alert("Failed to update content bank");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const totalAuthored = contentBank.reduce((acc, c) => acc + c.authored, 0);
  const totalValidated = contentBank.reduce((acc, c) => acc + c.validated, 0);

  return (
    <>
      <Panel title="Content Bank Coverage" sub={`Items authored (${totalAuthored}) & validated (${totalValidated}) vs. target of 40 per skill`}
        right={
          <button
            onClick={() => setShowUpdateModal(true)}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: COLORS.teal, color: "#0B1220",
              border: "none", borderRadius: 9, padding: "8px 14px", fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, cursor: "pointer"
            }}
          >
            <Plus size={14} /> Update Content
          </button>
        }>
        {loading && contentBank.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", fontFamily: "Inter", color: COLORS.sub }}>
            Loading content bank statistics...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={contentBank}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="skill" tick={{ fill: COLORS.sub, fontSize: 12, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }} />
              <Bar dataKey="authored" name="Authored" fill={COLORS.sub} radius={[5, 5, 0, 0]} barSize={20} />
              <Bar dataKey="validated" name="Validated" fill={COLORS.teal} radius={[5, 5, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Panel>
      
      <div style={{ height: 16 }} />
      
      <Panel title="Validation Status by Skill" sub="Percentage of target items (40) validated by a cybersecurity consultant">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && contentBank.length === 0 ? (
            <div style={{ color: COLORS.sub, textAlign: "center" }}>Loading validation status...</div>
          ) : (
            contentBank.map((c, i) => {
              const pct = Math.min(100, Math.round((c.validated / c.target) * 100));
              return (
                <div key={i}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.text }}>{c.skill}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{c.validated}/{c.target} validated ({pct}%)</span>
                  </div>
                  <div style={{ height: 8, background: COLORS.panelAlt, borderRadius: 5, overflow: "hidden" }}>
                    <div style={{
                      width: `${pct}%`, height: "100%",
                      background: pct >= 75 ? COLORS.teal : pct >= 40 ? COLORS.amber : COLORS.coral,
                      borderRadius: 5, transition: "width 0.4s"
                    }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      {/* Update Content Modal */}
      {showUpdateModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(11, 18, 32, 0.75)", backdropFilter: "blur(4px)", fontFamily: "Inter, sans-serif"
        }}>
          <div style={{
            background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 16,
            width: "100%", maxWidth: 380, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,0.5)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, margin: 0 }}>Update Content Bank</h3>
              <button onClick={() => setShowUpdateModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer", color: COLORS.sub }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleUpdateContent} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Select Skill Category *</label>
                <select
                  value={selectedSkill} onChange={e => setSelectedSkill(e.target.value)}
                  style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                >
                  <option value="Phishing">Phishing</option>
                  <option value="Smishing">Smishing</option>
                  <option value="Vishing">Vishing</option>
                  <option value="Pretexting">Pretexting</option>
                  <option value="Baiting">Baiting</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Add Authored Items</label>
                <input
                  type="number" min="0" value={addAuthored} onChange={e => setAddAuthored(e.target.value)} placeholder="e.g. 5 (will be added to total)"
                  style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.sub, display: "block", marginBottom: 5 }}>Add Validated Items</label>
                <input
                  type="number" min="0" value={addValidated} onChange={e => setAddValidated(e.target.value)} placeholder="e.g. 3 (will be added to total)"
                  style={{ width: "100%", padding: "10px 12px", background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontSize: 13, outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button" onClick={() => setShowUpdateModal(false)}
                  style={{ flex: 1, padding: "10px 0", background: "transparent", border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={submitting}
                  style={{ flex: 1, padding: "10px 0", background: COLORS.teal, border: "none", borderRadius: 8, color: "#0B1220", fontWeight: 700, fontSize: 13.5, cursor: submitting ? "default" : "pointer", opacity: submitting ? 0.7 : 1 }}
                >
                  {submitting ? "Updating..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
