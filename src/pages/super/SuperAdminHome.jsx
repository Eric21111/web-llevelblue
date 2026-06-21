import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell,
  LineChart, Line,
} from "recharts";
import { Users, GraduationCap, TrendingUp, Zap } from "lucide-react";
import StatCard from "../../components/StatCard";
import Panel from "../../components/Panel";
import { sectionComparison, bktHealth, technicalVsNon } from "../../data/mockData";
import { COLORS } from "../../constants/colors";

export default function SuperAdminHome() {
  return (
    <>
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard icon={Users} label="Active Teachers" value={3} delta="1 invited" deltaUp accent={COLORS.teal} />
        <StatCard icon={GraduationCap} label="Total Students" value={138} delta="12" deltaUp accent={COLORS.teal2} />
        <StatCard icon={TrendingUp} label="Institution Avg. Gain" value={34.9} suffix=" pts" delta="2.1 pts" deltaUp accent={COLORS.amber} />
        <StatCard icon={Zap} label="BKT Model AUC" value="0.89" delta="0.03" deltaUp accent={COLORS.coral} />
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
