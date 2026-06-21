import { useState } from "react";
import { Search } from "lucide-react";
import Panel from "../../components/Panel";
import StatusPill from "../../components/StatusPill";
import MiniRadar from "../../components/MiniRadar";
import { students } from "../../data/mockData";
import { COLORS } from "../../constants/colors";

export default function ClassRoster() {
  const [query, setQuery] = useState("");
  const filtered = students.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Panel title="Class Roster" sub={`${students.length} students across 2 sections`}
      right={
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 9, padding: "7px 12px" }}>
          <Search size={14} color={COLORS.sub} />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students..."
            style={{ background: "transparent", border: "none", outline: "none", color: COLORS.text, fontFamily: "Inter", fontSize: 12.5, width: 150 }} />
        </div>
      }>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.4fr 1fr 1fr 0.8fr 0.8fr", gap: 8, padding: "0 12px 10px", fontFamily: "Inter", fontSize: 11, fontWeight: 700, color: COLORS.sub, letterSpacing: 0.4, textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}` }}>
        <div>Student</div><div>Section</div><div>Mastery</div><div>Skill Radar</div><div>Pre→Post</div><div>Sessions</div><div>Points</div><div>Status</div>
      </div>
      {filtered.map(s => {
        const avg = Math.round(Object.values(s.mastery).reduce((a, b) => a + b, 0) / 5 * 100);
        return (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.4fr 1fr 1fr 0.8fr 0.8fr", gap: 8, alignItems: "center", padding: "11px 12px", borderBottom: `1px solid ${COLORS.border}` }}>
            <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: COLORS.text }}>{s.name}{s.technical && <span style={{ marginLeft: 6, fontSize: 10, color: COLORS.teal, fontWeight: 600 }}>TECH</span>}</div>
            <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }}>{s.section.split(" - ")[1]}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: avg >= 70 ? COLORS.teal : avg >= 50 ? COLORS.amber : COLORS.coral }}>{avg}%</div>
            <MiniRadar data={s.mastery} />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{s.pre} → <span style={{ color: COLORS.text, fontWeight: 700 }}>{s.post}</span></div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{s.sessions}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 700, color: COLORS.text }}>{s.points.toLocaleString()}</div>
            <StatusPill status={s.status} />
          </div>
        );
      })}
    </Panel>
  );
}
