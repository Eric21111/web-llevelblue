import Panel from "../../components/Panel";
import { teacherAccounts } from "../../data/mockData";
import { COLORS } from "../../constants/colors";

export default function TeacherManagement() {
  return (
    <Panel title="Teacher & Admin Accounts" sub="Manage access for teacher (admin) accounts across sections"
      right={<button style={{ background: COLORS.teal, color: "#0B1220", border: "none", borderRadius: 9, padding: "8px 14px", fontFamily: "Inter", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}>+ Invite Teacher</button>}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 8, padding: "0 12px 10px", fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: COLORS.sub, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}` }}>
        <div>Name</div><div>Email</div><div>Sections</div><div>Students</div><div>Status</div>
      </div>
      {teacherAccounts.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "12px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: COLORS.panelAlt, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700, color: COLORS.teal }}>
              {t.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
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
        </div>
      ))}
    </Panel>
  );
}
