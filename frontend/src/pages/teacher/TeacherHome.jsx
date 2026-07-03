import { useState, useEffect, useRef } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  LineChart, Line,
} from "recharts";
import {
  Target, TrendingUp, AlertTriangle, Activity,
  BellRing, X, ChevronRight, ShieldAlert, RefreshCw,
} from "lucide-react";
import StatCard from "../../components/StatCard";
import Panel from "../../components/Panel";
import StatusPill from "../../components/StatusPill";
import MiniRadar from "../../components/MiniRadar";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

const SKILL_COLORS = {
  Phishing: COLORS.teal,
  Smishing: COLORS.amber,
  Vishing: COLORS.coral,
  Pretexting: "#7C9EF2",
  Baiting: "#C792EA",
};

const POLL_INTERVAL = 30000; // 30 seconds

export default function TeacherHome() {
  const [students, setStudents] = useState([]);
  const [classMasteryRadar, setClassMasteryRadar] = useState([]);
  const [masteryGrowthOverTime, setMasteryGrowthOverTime] = useState([]);
  const [quizTypeAccuracy, setQuizTypeAccuracy] = useState([]);
  const [atRisk, setAtRisk] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [lastPolled, setLastPolled] = useState(null);
  const pollRef = useRef(null);

  const fetchDashboardData = () => {
    Promise.all([
      apiFetch("/api/students").then((res) => res.json()),
      apiFetch("/api/analytics").then((res) => res.json()),
      apiFetch("/api/analytics/at-risk").then((res) => res.json()),
    ])
      .then(([studentsData, analyticsData, atRiskData]) => {
        setStudents(studentsData || []);
        setClassMasteryRadar(analyticsData.classMasteryRadar || []);
        setMasteryGrowthOverTime(analyticsData.masteryGrowthOverTime || []);
        setQuizTypeAccuracy(analyticsData.quizTypeAccuracy || []);
        setAtRisk(Array.isArray(atRiskData) ? atRiskData : []);
        setLastPolled(new Date());
      })
      .catch((err) => console.error("Error fetching dashboard data:", err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
    pollRef.current = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(pollRef.current);
  }, []);

  const activeAlerts = atRisk.filter((s) => !dismissedAlerts.has(s.id));

  const avgMastery = classMasteryRadar.length > 0
    ? Math.round(classMasteryRadar.reduce((a, b) => a + b.mastery, 0) / classMasteryRadar.length)
    : 0;
  const avgGain = students.length > 0
    ? Math.round(students.reduce((a, s) => a + (s.post - s.pre), 0) / students.length)
    : 0;
  const activeRate = students.length > 0
    ? Math.round((students.filter((s) => s.sessions > 0).length / students.length) * 100)
    : 0;

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontFamily: "Inter", color: COLORS.sub }}>
        Loading dashboard metrics...
      </div>
    );
  }

  return (
    <>
      {/* ── REMEDIATION ENGINE ALERT BANNER ── */}
      {activeAlerts.length > 0 && (
        <div style={{ marginBottom: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {activeAlerts.map((student) => (
            <div key={student.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "13px 16px",
              background: "linear-gradient(90deg, rgba(239,91,91,0.12), rgba(239,91,91,0.06))",
              border: `1px solid rgba(239,91,91,0.35)`, borderRadius: 12,
              animation: "pulse-border 2s ease-in-out infinite",
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: "rgba(239,91,91,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <ShieldAlert size={20} color={COLORS.coral} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13.5, color: COLORS.coral }}>
                    Action Required:
                  </span>
                  <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13.5, color: COLORS.text }}>
                    {student.name}
                  </span>
                  <span style={{ fontFamily: "Inter", fontSize: 12.5, color: COLORS.sub }}>
                    · {student.section}
                  </span>
                </div>
                <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }}>
                  Failing:{" "}
                  {student.failingSkills.map((skill, i) => (
                    <span key={skill}>
                      <span style={{ color: SKILL_COLORS[skill] || COLORS.amber, fontWeight: 600 }}>{skill}</span>
                      {i < student.failingSkills.length - 1 && ", "}
                    </span>
                  ))}
                  {" "}· {student.sessions} sessions · last active {student.lastActive ?? "—"}
                </div>
              </div>
              <button
                onClick={() => setDismissedAlerts((prev) => new Set([...prev, student.id]))}
                title="Dismiss alert"
                style={{ background: "transparent", border: "none", cursor: "pointer", display: "flex", padding: 4, flexShrink: 0 }}
              >
                <X size={15} color={COLORS.sub} />
              </button>
            </div>
          ))}

          {/* Poll status indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, paddingLeft: 2 }}>
            <RefreshCw size={11} color={COLORS.sub} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: COLORS.sub }}>
              Auto-refresh every 30s · last checked{" "}
              {lastPolled ? lastPolled.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—"}
            </span>
          </div>
        </div>
      )}

      {/* ── STAT CARDS ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon={Target} label="Class Avg. Mastery" value={avgMastery} suffix="%" delta="Live" deltaUp accent={COLORS.teal} />
        <StatCard icon={TrendingUp} label="Avg. Pre→Post Gain" value={avgGain} suffix=" pts" delta="Live" deltaUp accent={COLORS.teal2} />
        <StatCard
          icon={AlertTriangle}
          label="At-Risk Students"
          value={activeAlerts.length}
          delta={activeAlerts.length > 0 ? "Needs attention" : "All on track"}
          deltaUp={activeAlerts.length === 0}
          accent={activeAlerts.length > 0 ? COLORS.coral : COLORS.teal}
        />
        <StatCard icon={Activity} label="Weekly Active Rate" value={activeRate} suffix="%" delta="Live" deltaUp accent={COLORS.amber} />
      </div>

      {/* ── CLASS SKILL MASTERY + GROWTH ── */}
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
              <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 11, color: COLORS.sub }} />
              {Object.entries(SKILL_COLORS).map(([skill, color]) => (
                <Line key={skill} type="monotone" dataKey={skill} stroke={color} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── QUIZ TYPE ACCURACY ── */}
      <Panel title="Quiz Type Accuracy" sub="Correctness rate filtered by quiz interaction type" style={{ marginBottom: 16 }}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={quizTypeAccuracy} layout="vertical" margin={{ left: 10 }}>
            <CartesianGrid stroke={COLORS.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="type" width={160} tick={{ fill: COLORS.text, fontSize: 12, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => [`${v}%`, "Accuracy"]} contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
            <Bar dataKey="accuracy" radius={[0, 7, 7, 0]} barSize={28}>
              {(quizTypeAccuracy || []).map((_, i) => (
                <Cell key={i} fill={[COLORS.teal, COLORS.teal2, COLORS.amber][i % 3]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── AT-RISK STUDENT DETAIL LIST ── */}
      <Panel
        title="At-Risk Students"
        sub="Below mastery threshold — flagged for remediation follow-up"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {atRisk.length > 0 && (
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.coral, boxShadow: `0 0 6px ${COLORS.coral}` }} />
            )}
            <span style={{ fontFamily: "Inter", fontSize: 11.5, color: COLORS.sub }}>
              {atRisk.length} flagged
            </span>
          </div>
        }
      >
        {atRisk.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0", fontFamily: "Inter", color: COLORS.sub, fontSize: 13.5 }}>
            🎉 No students are currently at risk. Great work!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {atRisk.map((s) => (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 14, padding: "12px 14px",
                background: dismissedAlerts.has(s.id) ? COLORS.panelAlt : "rgba(239,91,91,0.05)",
                borderRadius: 10,
                border: `1px solid ${dismissedAlerts.has(s.id) ? COLORS.border : "rgba(239,91,91,0.2)"}`,
              }}>
                <MiniRadar data={s.mastery} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13.5, color: COLORS.text }}>{s.name}</div>
                  <div style={{ fontFamily: "Inter", fontSize: 11.5, color: COLORS.sub, marginTop: 2 }}>
                    {s.section} · {s.sessions} sessions · last active {s.lastActive ?? "—"}
                  </div>
                  <div style={{ marginTop: 5, display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {s.failingSkills.map((skill) => (
                      <span key={skill} style={{
                        fontFamily: "Inter", fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
                        background: `${SKILL_COLORS[skill] || COLORS.amber}22`,
                        color: SKILL_COLORS[skill] || COLORS.amber,
                        border: `1px solid ${SKILL_COLORS[skill] || COLORS.amber}44`,
                      }}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
                <StatusPill status={s.status} />
                <ChevronRight size={16} color={COLORS.sub} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
