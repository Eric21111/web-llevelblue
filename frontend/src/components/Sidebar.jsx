import { Shield, LogOut } from "lucide-react";
import { COLORS } from "../constants/colors";

export default function Sidebar({ role, user, page, setPage, pages, onLogout }) {
  return (
    <div style={{
      width: 232, background: "#0B1220", borderRight: `1px solid ${COLORS.border}`,
      display: "flex", flexDirection: "column", padding: "20px 16px", flexShrink: 0,
      overflow: "hidden",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, padding: "0 4px" }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${COLORS.teal}, #2178C2)`,
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <Shield size={18} color="#0B1220" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16, color: COLORS.text, letterSpacing: -0.2 }}>LevelBlue</div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10.5, color: COLORS.sub, letterSpacing: 0.5 }}>ANALYTICS CONSOLE</div>
        </div>
      </div>

      <div style={{ fontFamily: "Inter, sans-serif", fontSize: 10.5, color: COLORS.sub, letterSpacing: 0.8, fontWeight: 700, padding: "0 8px", marginBottom: 8, marginTop: 4 }}>
        MENU
      </div>
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {pages.map((p, i) => (
          <button key={p.label} onClick={() => setPage(i)} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9,
            border: "none", cursor: "pointer", textAlign: "left",
            background: page === i ? COLORS.panelAlt : "transparent",
            color: page === i ? COLORS.text : COLORS.sub,
            fontFamily: "Inter, sans-serif", fontWeight: page === i ? 600 : 500, fontSize: 13.5,
          }}>
            <p.icon size={16} strokeWidth={2} color={page === i ? COLORS.teal : COLORS.sub} />
            {p.label}
          </button>
        ))}
      </nav>

      <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 6px" }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%", background: COLORS.panelAlt,
            display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 12, fontWeight: 700, color: COLORS.teal, flexShrink: 0, overflow: "hidden",
          }}>
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              ((user?.firstName?.[0] || "").toUpperCase() + (user?.lastName?.[0] || "").toUpperCase()) || (role === "admin" ? "T" : "SA")
            )}
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 12.5, fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }} title={user?.name || "User"}>
              {user?.name || "User"}
            </div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: COLORS.sub }}>
              {role === "admin" ? "Teacher" : (user?.roleLabel || "Department Head")}
            </div>
          </div>
          <button onClick={onLogout} title="Sign out" style={{
            background: "transparent", border: "none", cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center", padding: 6, borderRadius: 7, flexShrink: 0,
          }}>
            <LogOut size={15} color={COLORS.sub} />
          </button>
        </div>
      </div>
    </div>
  );
}
