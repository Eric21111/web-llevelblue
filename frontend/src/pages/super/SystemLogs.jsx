import { useState, useEffect } from "react";
import Panel from "../../components/Panel";
import { COLORS } from "../../constants/colors";
import { apiFetch } from "../../utils/api";

export default function SystemLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = (silent = false) => {
    if (!silent) setLoading(true);
    apiFetch("/api/system-logs")
      .then((res) => res.json())
      .then((data) => setLogs(data || []))
      .catch((err) => console.error("Error loading system logs:", err))
      .finally(() => { if (!silent) setLoading(false); });
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(() => fetchLogs(true), 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Panel title="System Logs & Audit Trail" sub="Recent activity across accounts, database changes, and feedback pipeline">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {loading ? (
          <div style={{ color: COLORS.sub, textAlign: "center", padding: "20px 0", fontFamily: "Inter" }}>
            Loading audit trail...
          </div>
        ) : logs.length === 0 ? (
          <div style={{ color: COLORS.sub, textAlign: "center", padding: "20px 0", fontFamily: "Inter" }}>
            No logs recorded yet. Action history will appear here.
          </div>
        ) : (
          logs.map((l, i) => {
            const isSuccess = l.action.toLowerCase().includes("add") || l.action.toLowerCase().includes("login");
            const isDelete = l.action.toLowerCase().includes("delete") || l.action.toLowerCase().includes("remove");
            
            return (
              <div key={l.id || i} style={{ display: "flex", gap: 14, padding: "12px 4px", borderBottom: i < logs.length - 1 ? `1px solid ${COLORS.border}` : "none" }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%", marginTop: 5, flexShrink: 0,
                  background: isSuccess ? COLORS.teal : isDelete ? COLORS.coral : COLORS.amber,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontFamily: "Inter", fontWeight: 600, fontSize: 13, color: COLORS.text }}>{l.action}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: COLORS.sub }}>
                      {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {new Date(l.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ fontFamily: "Inter", fontSize: 12, color: COLORS.sub, marginTop: 2 }}>
                    <strong>{l.user}</strong>: {l.details}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
