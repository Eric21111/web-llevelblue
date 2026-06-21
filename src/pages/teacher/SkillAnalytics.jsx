import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
} from "recharts";
import Panel from "../../components/Panel";
import { quizTypeAccuracy, slipPatterns, prePostComparison } from "../../data/mockData";
import { COLORS } from "../../constants/colors";

export default function SkillAnalytics() {
  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Quiz Type Accuracy" sub="Correctness rate by question interaction type">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={quizTypeAccuracy} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={COLORS.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="type" width={140} tick={{ fill: COLORS.text, fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} fill={COLORS.teal} barSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top Slip Patterns" sub="Enemies/attacks generating the most knowledge-gap events">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={slipPatterns} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={COLORS.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="enemy" width={130} tick={{ fill: COLORS.text, fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <Bar dataKey="slips" radius={[0, 6, 6, 0]} barSize={26}>
                {slipPatterns.map((d, i) => <Cell key={i} fill={d.domain === "Technical" ? COLORS.teal : d.domain === "Physical" ? COLORS.amber : COLORS.coral} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Pre-Test vs. Post-Test Scores" sub="Per-student comparison supporting paired-samples analysis">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={prePostComparison}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
            <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }} />
            <Bar dataKey="pre" name="Pre-Test" fill={COLORS.sub} radius={[5, 5, 0, 0]} barSize={14} />
            <Bar dataKey="post" name="Post-Test" fill={COLORS.teal} radius={[5, 5, 0, 0]} barSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </>
  );
}
