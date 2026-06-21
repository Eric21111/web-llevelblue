import { COLORS } from "../constants/colors";

export default function Panel({ title, sub, children, right, span }) {
  return (
    <div style={{
      background: COLORS.panel, border: `1px solid ${COLORS.border}`, borderRadius: 14,
      padding: "20px 22px", gridColumn: span ? `span ${span}` : undefined,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: COLORS.text, margin: 0 }}>{title}</h3>
          {sub && <p style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, color: COLORS.sub, margin: "3px 0 0" }}>{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}
