import { RadarChart, PolarGrid, Radar, ResponsiveContainer } from "recharts";
import { SKILLS } from "../data/mockData";
import { COLORS } from "../constants/colors";

export default function MiniRadar({ data }) {
  const points = SKILLS.map(s => ({ skill: s.slice(0, 3), val: Math.round((data[s] || 0) * 100) }));
  return (
    <ResponsiveContainer width={64} height={48}>
      <RadarChart data={points} outerRadius={20}>
        <PolarGrid stroke={COLORS.border} radialLines={false} />
        <Radar dataKey="val" stroke={COLORS.teal} fill={COLORS.teal} fillOpacity={0.4} strokeWidth={1.5} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
