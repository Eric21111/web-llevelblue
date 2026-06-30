import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  LineChart, Line,
} from "recharts";
import { Users, GraduationCap, TrendingUp, Zap } from "lucide-react";
import StatCard from "../../components/StatCard";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";

export default function SuperAdminHome() {
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/teachers").then((res) => res.json()),
      fetch("/api/students").then((res) => res.json()),
      fetch("/api/analytics").then((res) => res.json())
    ])
      .then(([teachersData, studentsData, analyticsData]) => {
        setTeachers(teachersData || []);
        setStudents(studentsData || []);
        setAnalytics(analyticsData);
      })
      .catch((err) => console.error("Error loading super admin dashboard:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !analytics) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontFamily: "Inter", color: COLORS.sub }}>
        Loading dashboard metrics...
      </div>
    );
  }

  const { sectionComparison = [], bktHealth = [], technicalVsNon = [] } = analytics;

  const activeTeachersCount = teachers.filter(t => t.status === "Active").length;
  const totalStudentsCount = students.length;
  const avgInstitutionGain = students.length > 0 
    ? Number((students.reduce((a, s) => a + (s.post - s.pre), 0) / students.length).toFixed(1)) 
    : 0;
  const latestAuc = bktHealth.length > 0 ? bktHealth[bktHealth.length - 1].auc : 0.89;
  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon={Users} label="Active Teachers" value={activeTeachersCount} delta={`${teachers.filter(t => t.status === "Invited").length} invited`} deltaUp accent={COLORS.teal} />
        <StatCard icon={GraduationCap} label="Total Students" value={totalStudentsCount} delta={`${totalStudentsCount > 0 ? "Live" : "Empty"}`} deltaUp accent={COLORS.teal2} />
        <StatCard icon={TrendingUp} label="Institution Avg. Gain" value={avgInstitutionGain} suffix=" pts" delta="Live stats" deltaUp accent={COLORS.amber} />
        <StatCard icon={Zap} label="BKT Model AUC" value={latestAuc} delta="0.03" deltaUp accent={COLORS.coral} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel title="Mastery Gain by Section" sub="Normalized learning gain, pre→post, per teacher section">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={sectionComparison}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="section" tick={{ fill: COLORS.sub, fontSize: 12, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }}
                formatter={(v, n, p) => [`${v} pts`, p.payload.teacher]} />
              <Bar dataKey="gain" radius={[6, 6, 0, 0]} barSize={44}>
                {sectionComparison.map((d, i) => <Cell key={i} fill={[COLORS.teal, COLORS.teal2, COLORS.amber, "#7C9EF2"][i % 4]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="BKT Model Predictive Accuracy" sub="RMSE (lower is better) & AUC (higher is better) over time">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={bktHealth}>
              <CartesianGrid stroke={COLORS.grid} vertical={false} />
              <XAxis dataKey="week" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
              <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
              <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }} />
              <Line type="monotone" dataKey="auc" name="AUC" stroke={COLORS.teal} strokeWidth={2.5} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="rmse" name="RMSE" stroke={COLORS.coral} strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Technical vs. Non-Technical Outcomes" sub="Secondary analysis — does personalization help non-technical users comparably?">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={technicalVsNon} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid stroke={COLORS.grid} horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="group" width={140} tick={{ fill: COLORS.text, fontSize: 13, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
            <Legend wrapperStyle={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub }} />
            <Bar dataKey="pre" name="Pre-Test" fill={COLORS.sub} radius={[0, 5, 5, 0]} barSize={22} />
            <Bar dataKey="post" name="Post-Test" fill={COLORS.teal} radius={[0, 5, 5, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>
    </>
  );
}
