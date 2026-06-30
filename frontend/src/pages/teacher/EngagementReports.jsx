import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";

export default function EngagementReports() {
  const [students, setStudents] = useState([]);
  const [engagementTrend, setEngagementTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/students").then((res) => res.json()),
      fetch("/api/analytics").then((res) => res.json())
    ])
      .then(([studentsData, analyticsData]) => {
        setStudents(studentsData || []);
        setEngagementTrend(analyticsData.engagementTrend || []);
      })
      .catch((err) => console.error("Error loading engagement reports:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh", fontFamily: "Inter", color: COLORS.sub }}>
        Loading engagement reports...
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
      <Panel title="Weekly Session Activity" sub="Number of play sessions logged per day, this week">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={engagementTrend}>
            <CartesianGrid stroke={COLORS.grid} vertical={false} />
            <XAxis dataKey="day" tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={{ stroke: COLORS.border }} tickLine={false} />
            <YAxis tick={{ fill: COLORS.sub, fontSize: 11.5, fontFamily: "Inter" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: COLORS.panelAlt, border: `1px solid ${COLORS.border}`, borderRadius: 8, fontFamily: "Inter", fontSize: 12 }} />
            <Bar dataKey="sessions" fill={COLORS.amber} radius={[6, 6, 0, 0]} barSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      <Panel title="Leaderboard (Top 5)" sub="Cloud-synced competitive ranking">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[...students].sort((a, b) => b.post - a.post).slice(0, 5).map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 10px", background: COLORS.panelAlt, borderRadius: 9 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                background: i === 0 ? COLORS.amber : COLORS.border, color: i === 0 ? "#0B1220" : COLORS.sub,
                fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 12,
              }}>{i + 1}</div>
              <div style={{ flex: 1, fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: COLORS.text }}>{s.name}</div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: COLORS.teal }}>{s.post * 10} pts</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
