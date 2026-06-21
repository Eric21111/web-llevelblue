import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";

export default function UsabilityFeedback() {
  const items = [
    { q: "The game was easy to navigate", mean: 4.4 },
    { q: "I understood why my answers were wrong", mean: 4.1 },
    { q: "The difficulty felt right for me", mean: 3.8 },
    { q: "I would recommend this to a classmate", mean: 4.5 },
    { q: "The quizzes felt relevant to real scams", mean: 4.2 },
  ];

  return (
    <Panel title="Usability & Acceptance Survey" sub="Weighted mean scores, 5-point scale (n = 42 respondents)">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((it, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontFamily: "Inter", fontSize: 13, color: COLORS.text }}>{it.q}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, color: COLORS.teal }}>{it.mean.toFixed(1)}</span>
            </div>
            <div style={{ height: 8, background: COLORS.panelAlt, borderRadius: 5, overflow: "hidden" }}>
              <div style={{ width: `${it.mean / 5 * 100}%`, height: "100%", background: `linear-gradient(90deg, ${COLORS.teal2}, ${COLORS.teal})`, borderRadius: 5 }} />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
