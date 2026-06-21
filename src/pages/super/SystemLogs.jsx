import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";

export default function SystemLogs() {
  const logs = [
    { time: "10:42 AM", event: "Firestore sync completed", type: "info", detail: "138 student profiles synced" },
    { time: "09:15 AM", event: "Teacher account created", type: "info", detail: "Dahlia Reyes invited by Dept. Head" },
    { time: "08:03 AM", event: "BKT batch recalculation", type: "success", detail: "Mastery probabilities updated for 4 sections" },
    { time: "Yesterday", event: "Sync delay detected", type: "warning", detail: "Firestore write retried after 4.2s timeout" },
    { time: "Yesterday", event: "Content item flagged", type: "warning", detail: "Vishing item #18 pending consultant review" },
    { time: "2 days ago", event: "New section added", type: "info", detail: "Grade 10 - Topaz under M. Ellih" },
  ];

  return (
    <Panel title="System Logs & Audit Trail" sub="Recent activity across accounts, sync, and content pipeline">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {logs.map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "12px 4px", borderBottom: i < logs.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
              background: l.type === "success" ? COLORS.teal : l.type === "warning" ? COLORS.amber : COLORS.sub,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: COLORS.text }}>{l.event}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: COLORS.sub }}>{l.time}</span>
              </div>
              <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 2 }}>{l.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
