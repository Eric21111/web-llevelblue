import { COLORS } from "../constants/colors";

export default function StatusPill({ status }) {
  const map = {
    "On Track": { c: COLORS.teal, bg: "rgba(61,214,196,0.12)" },
    "At Risk": { c: COLORS.coral, bg: "rgba(239,91,91,0.12)" },
    "Needs Review": { c: COLORS.amber, bg: "rgba(242,169,59,0.12)" },
  };
  const s = map[status] || map["On Track"];
  return (
    <span style={{
      fontFamily: "Inter, sans-serif", fontSize: 11.5, fontWeight: 600, color: s.c, background: s.bg,
      padding: "4px 10px", borderRadius: 20, whiteSpace: "nowrap",
    }}>{status}</span>
  );
}
