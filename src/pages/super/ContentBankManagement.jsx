import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Panel from "../../components/Panel";
import { contentBank } from "../../data/mockData";
import { COLORS } from "../../constants/colors";

export default function ContentBankManagement() {
  return (
    <>
      <Panel title="Content Bank Coverage" sub="Items authored & validated vs. target of 40 per skill (200 total)">
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
      </Panel>
      <div style={{ height: 16 }} />
      <Panel title="Validation Status by Skill" sub="Percentage of authored items validated by a cybersecurity consultant">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {contentBank.map((c, i) => {
            const pct = Math.round(c.validated / c.target * 100);
            return (
              <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.text }}>{c.skill}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: COLORS.sub }}>{c.validated}/{c.target} validated</span>
                </div>
                <div style={{ height: 8, background: COLORS.panelAlt, borderRadius: 5, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: pct >= 75 ? COLORS.teal : COLORS.amber, borderRadius: 5 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
