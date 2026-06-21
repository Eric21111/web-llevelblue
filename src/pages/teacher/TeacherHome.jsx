import { useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Target, TrendingUp, AlertTriangle, Activity, ChevronRight } from "lucide-react";
import StatCard from "../../components/StatCard";
import Panel from "../../components/Panel";
import StatusPill from "../../components/StatusPill";
import MiniRadar from "../../components/MiniRadar";
import { classMasteryRadar, students, masteryGrowthOverTime } from "../../data/mockData";
import { COLORS } from "../../constants/colors";

export default function TeacherHome() {
  const atRiskCount = students.filter(s => s.status === "At Risk").length;
  const avgMastery = Math.round(classMasteryRadar.reduce((a, b) => a + b.mastery, 0) / classMasteryRadar.length);
  const avgGain = Math.round(students.reduce((a, s) => a + (s.post - s.pre), 0) / students.length);

  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon={Target} label="Class Avg. Mastery" value={avgMastery} suffix="%" delta="4.2%" deltaUp accent={COLORS.teal} />
        <StatCard icon={TrendingUp} label="Avg. Pre→Post Gain" value={avgGain} suffix=" pts" delta="6 pts" deltaUp accent={COLORS.teal2} />
        <StatCard icon={AlertTriangle} label="At-Risk Students" value={atRiskCount} delta="1" deltaUp={false} accent={COLORS.coral} />
        <StatCard icon={Activity} label="Weekly Active Rate" value={87} suffix="%" delta="3%" deltaUp accent={COLORS.amber} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Class Skill Mastery" sub="Average BKT mastery probability per attack type vs. 70% target">
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={classMasteryRadar} outerRadius={95}>
              <PolarGrid stroke={COLORS.grid} />
              <PolarAngleAxis dataKey="skill" tick={{ fill: COLORS.sub, fontSize: 12, fontFamily: "Inter" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Class Avg" dataKey="mastery" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.32} strokeWidth={2} />
              <Radar name="Target" dataKey="target" stroke={COLORS.amber} fill="transparent" strokeWidth={1.5} strokeDasharray="4 4" />
              <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }} />
            </RadarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Mastery Growth Over Time" sub="Average skill mastery (%) by week, all students">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={masteryGrowthOverTime}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="week" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub }} />
              <Line type="monotone" dataKey="Phishing" stroke={COLORS.teal} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Smishing" stroke={COLORS.amber} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Vishing" stroke={COLORS.coral} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Pretexting" stroke="#7C9EF2" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Baiting" stroke="#C792EA" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="At-Risk Students" sub="Below mastery threshold on 2 or more skills — flagged for follow-up">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {students.filter(s => s.status !== "On Track").map(s => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", gap: 14, padding: "10px 12px",
              background: COLORS.panelAlt, borderRadius: 10, border: `1px solid ${COLORS.border}`,
            }}>
              <MiniRadar data={s.mastery} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13.5, color: COLORS.text }}>{s.name}</div>
                <div style={{ fontFamily: "Inter", fontSize: 11.5, color: COLORS.sub }}>{s.section} · {s.sessions} sessions · last active {s.lastActive}</div>
              </div>
              <StatusPill status={s.status} />
              <ChevronRight size={16} color={COLORS.sub} />
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
