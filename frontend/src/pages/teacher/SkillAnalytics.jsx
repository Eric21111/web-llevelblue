import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

const SKILL_COLORS = ["#3DD6C4", "#F2A93B", "#EF5B5B", "#7C9EF2", "#C792EA"];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "Inter", fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, marginTop: 2 }}>
          {p.name}: {p.value}{typeof p.value === "number" && p.name !== "slips" ? "%" : ""}
        </div>
      ))}
    </div>
  );
};

export default function SkillAnalytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);

  const fetchData = (silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([
      apiFetch("/api/analytics").then((r) => r.json()),
      apiFetch("/api/students").then((r) => r.json()),
    ])
      .then(([analyticsData, studentsData]) => {
        setAnalytics(analyticsData);
        setStudents(studentsData || []);
      })
      .catch((err) => console.error("Error loading analytics:", err))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !analytics) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontFamily: "Inter", color: COLORS.sub }}>
        Loading skill analytics...
      </div>
    );
  }

  const { quizTypeAccuracy = [], slipPatterns = [], prePostComparison = [], classMasteryRadar = [] } = analytics;

  // Build per-skill mastery breakdown from student data
  const SKILLS = ["Phishing", "Smishing", "Vishing", "Pretexting", "Baiting"];
  const skillBreakdown = SKILLS.map((skill, i) => {
    const key = `mastery${skill.charAt(0).toUpperCase() + skill.slice(1)}`;
    // use classMasteryRadar already computed by backend
    const radarEntry = classMasteryRadar.find((r) => r.skill === skill);
    return {
      skill,
      mastery: radarEntry?.mastery ?? 0,
      target: 70,
      color: SKILL_COLORS[i],
    };
  });

  return (
    <>
      {/* ── SKILL MASTERY BREAKDOWN ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Skill Mastery Breakdown" sub="Class-average BKT mastery (%) per attack-type node vs. 70% threshold">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={skillBreakdown} margin={{ top: 8 }}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="skill" tick={{ fill: COLORS.sub, fontSize: 12, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={70} stroke={COLORS.amber} strokeDasharray="5 5" label={{ value: "Target 70%", fill: COLORS.amber, fontSize: 11, fontFamily: "Inter", position: "insideTopRight" }} />
              <Bar dataKey="mastery" radius={[6, 6, 0, 0]} barSize={42}>
                {skillBreakdown.map((entry, i) => (
                  <Cell key={entry.skill} fill={entry.mastery < 70 ? COLORS.coral : entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend row */}
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            {skillBreakdown.map((s) => (
              <div key={s.skill} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.mastery < 70 ? COLORS.coral : s.color }} />
                <span style={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub }}>{s.skill}: <strong style={{ color: s.mastery < 70 ? COLORS.coral : COLORS.text }}>{s.mastery}%</strong></span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Skill Mastery Radar" sub="Radial view of all BKT nodes vs. target">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={classMasteryRadar} outerRadius={88}>
              <PolarGrid stroke={COLORS.grid} />
              <PolarAngleAxis dataKey="skill" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} />
              <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Class Avg" dataKey="mastery" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.3} strokeWidth={2} />
              <Radar name="Target" dataKey="target" stroke={COLORS.amber} fill="transparent" strokeWidth={1.5} strokeDasharray="5 5" />
              <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 11.5, color: COLORS.sub }} />
            </RadarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── QUIZ TYPE ACCURACY ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Quiz Type Accuracy" sub="Correctness rate by question interaction type">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={quizTypeAccuracy} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={COLORS.grid} horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="type" width={155} tick={{ fill: COLORS.text, fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <ReferenceLine x={70} stroke={COLORS.amber} strokeDasharray="4 4" />
              <Bar dataKey="accuracy" radius={[0, 7, 7, 0]} barSize={28}>
                {(quizTypeAccuracy || []).map((d, i) => (
                  <Cell key={i} fill={d.accuracy >= 70 ? COLORS.teal : COLORS.coral} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Top Slip Patterns" sub="Attack types generating the most knowledge-gap events">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={slipPatterns} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid stroke={COLORS.grid} horizontal={false} />
              <XAxis type="number" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="enemy" width={130} tick={{ fill: COLORS.text, fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <Bar dataKey="slips" radius={[0, 7, 7, 0]} barSize={28}>
                {(slipPatterns || []).map((d, i) => (
                  <Cell key={i} fill={d.domain === "Technical" ? COLORS.teal : d.domain === "Physical" ? COLORS.amber : COLORS.coral} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── PRE/POST COMPARISON ── */}
      <Panel title="Pre-Test vs. Post-Test Scores" sub="Per-student comparison — evidence of learning gain from ILS intervention">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={prePostComparison}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="name" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
            <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} domain={[0, 100]} />
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
