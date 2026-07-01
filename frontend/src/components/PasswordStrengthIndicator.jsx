import { COLORS } from "../constants/colors";

const RULES = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "One number (0–9)", test: (p) => /[0-9]/.test(p) },
  { label: "One special character (!@#$...)", test: (p) => /[^A-Za-z0-9]/.test(p) },
];

const LEVELS = [
  { label: "Very Weak", color: "#EF5B5B" },
  { label: "Weak", color: "#E87740" },
  { label: "Fair", color: "#F2A93B" },
  { label: "Good", color: "#8BD068" },
  { label: "Strong", color: COLORS.teal },
];

export default function PasswordStrengthIndicator({ password = "" }) {
  if (!password) return null;

  const passed = RULES.filter((r) => r.test(password)).length;
  const level = LEVELS[Math.min(passed, LEVELS.length) - 1] || LEVELS[0];
  const percent = (passed / RULES.length) * 100;

  return (
    <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Progress bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          flex: 1, height: 5, borderRadius: 99, background: COLORS.panelAlt,
          overflow: "hidden",
        }}>
          <div style={{
            width: `${percent}%`, height: "100%", borderRadius: 99,
            background: level.color,
            transition: "width 0.3s ease, background 0.3s ease",
          }} />
        </div>
        <span style={{
          fontFamily: "Inter", fontSize: 10.5, fontWeight: 700, color: level.color,
          minWidth: 60, textAlign: "right", letterSpacing: 0.2,
          transition: "color 0.3s ease",
        }}>
          {level.label}
        </span>
      </div>

      {/* Requirements checklist */}
      <div style={{
        display: "flex", flexDirection: "column", gap: 4,
        padding: "8px 10px", background: COLORS.panelAlt,
        border: `1px solid ${COLORS.border}`, borderRadius: 8,
      }}>
        {RULES.map((rule, i) => {
          const met = rule.test(password);
          return (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 8,
              transition: "opacity 0.2s",
            }}>
              <div style={{
                width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: met ? "rgba(61,214,196,0.15)" : "transparent",
                border: met ? `1.5px solid ${COLORS.teal}` : `1.5px solid ${COLORS.border}`,
                transition: "all 0.2s ease",
              }}>
                {met && (
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                    <path d="M1 4L3.5 6.5L9 1" stroke={COLORS.teal} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span style={{
                fontFamily: "Inter", fontSize: 11, fontWeight: 500,
                color: met ? COLORS.teal : COLORS.sub,
                textDecoration: met ? "none" : "none",
                transition: "color 0.2s ease",
              }}>
                {rule.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Returns true when every password rule passes */
export function isPasswordStrong(password) {
  return RULES.every((r) => r.test(password));
}
