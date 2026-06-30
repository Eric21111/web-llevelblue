import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { COLORS } from "../constants/colors";

export default function StatCard({ icon: Icon, label, value, delta, deltaUp, accent = COLORS.teal, suffix = "" }) {
  return (
    <div style={{
      background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14,
      padding: "18px 20px", flex: 1, minWidth: 200, position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -20, right: -20, width: 90, height: 90, borderRadius: "50%", background: accent, opacity: 0.08 }} />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: "Inter, sans-serif", fontSize: 12, fontWeight: 600, color: COLORS.sub, letterSpacing: 0.4, textTransform: "uppercase" }}>{label}</span>
        <Icon size={16} color={accent} strokeWidth={2.2} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 700, color: COLORS.text }}>{value}{suffix}</span>
        {delta && (
          <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 12.5, fontWeight: 600, color: deltaUp ? COLORS.teal : COLORS.coral, fontFamily: "'JetBrains Mono', monospace" }}>
            {deltaUp ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{delta}
          </span>
        )}
      </div>
    </div>
  );
}
