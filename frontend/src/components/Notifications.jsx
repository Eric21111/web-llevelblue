import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, X, ArrowUpRight, ShieldAlert, BookOpen, Activity, Users, RefreshCw } from "lucide-react";
import { useWorkspaceData } from "../context/WorkspaceDataContext";
import { buildNotifications, notificationStorageKey, readNotificationReceipts } from "../utils/notifications";
import { formatLastActive } from "../utils/time";

const icons = { support: ShieldAlert, learning: BookOpen, activity: Activity, team: Users };

export default function Notifications({ user, role, currentPath, onNavigate }) {
  const state = useWorkspaceData();
  const [open, setOpen] = useState(false);
  const key = notificationStorageKey(user, role);
  const [receipts, setReceipts] = useState(() => {
    try { return readNotificationReceipts(window.localStorage, key); } catch { return {}; }
  });
  const [storageUnavailable, setStorageUnavailable] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const closeRef = useRef(null);
  const items = buildNotifications(role, state.data);
  const unread = items.filter(item => receipts[item.id] !== item.revision).length;
  const failed = Object.keys(state.errors).length > 0;
  const close = () => { setOpen(false); triggerRef.current?.focus(); };

  useEffect(() => { setOpen(false); }, [currentPath]);
  useEffect(() => {
    const update = event => {
      if (event.key === key || event.key === null) {
        try { setReceipts(readNotificationReceipts(window.localStorage, key)); } catch { /* Keep session state. */ }
      }
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, [key]);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const outside = event => { if (!containerRef.current?.contains(event.target)) setOpen(false); };
    const escape = event => { if (event.key === "Escape") { setOpen(false); triggerRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  const markRead = entries => {
    const next = Object.fromEntries(Object.entries({ ...receipts, ...Object.fromEntries(entries.map(item => [item.id, item.revision])) }).slice(-100));
    setReceipts(next);
    try {
      if (key) window.localStorage.setItem(key, JSON.stringify(next));
      else setStorageUnavailable(true);
    } catch { setStorageUnavailable(true); }
  };
  return <div className="console-notifications" ref={containerRef}>
    <button ref={triggerRef} className="console-icon-button console-notification-trigger" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}${failed ? ", some information unavailable" : ""}`} aria-expanded={open} aria-controls="notification-panel" aria-haspopup="dialog" onClick={() => setOpen(value => !value)}><Bell size={20} />{unread > 0 && <span className="console-notification-badge" aria-hidden="true">{unread > 9 ? "9+" : unread}</span>}{failed && !unread && <span className="console-notification-warning" aria-hidden="true">!</span>}</button>
    {open && <section id="notification-panel" className="console-notification-panel" role="dialog" aria-labelledby="notification-title">
      <header><div><h2 id="notification-title">Notifications</h2><p>{state.loading ? "Checking your workspace…" : `${unread} unread · ${role === "super" ? "School updates" : "Teaching updates"}`}</p></div><button ref={closeRef} className="console-icon-button" aria-label="Close notifications" onClick={close}><X size={18} /></button></header>
      <div className="console-notification-tools"><span>Current alerts & recent activity</span><button className="dash-text-button" disabled={!unread} onClick={() => markRead(items)}><CheckCheck size={15} />Mark all read</button></div>
      <div className="console-notification-list">
        {failed && <div className="console-notification-error" role="status">Some updates couldn’t be loaded.<button className="dash-text-button" disabled={state.refreshing} onClick={state.refresh}>Try again</button></div>}
        {state.loading ? <div className="dash-empty" role="status"><RefreshCw size={22} className="dash-spin" /><strong>Loading notifications…</strong></div> : !items.length ? <div className="dash-empty"><Bell size={25} /><strong>{failed ? "Updates are unavailable" : "You’re all caught up"}</strong><p>{failed ? "Try refreshing to check your workspace." : "New learning alerts and workspace updates will appear here."}</p></div> : items.map(item => {
          const Icon = icons[item.kind];
          const isUnread = receipts[item.id] !== item.revision;
          return <button className={`console-notification-item ${isUnread ? "is-unread" : ""}`} key={item.id} onClick={() => { markRead([item]); setOpen(false); onNavigate(item.path); }}><span className={`console-notification-icon ${item.kind}`}><Icon size={18} /></span><span className="console-notification-copy"><strong>{item.title}{isUnread && <span className="dash-sr-only"> (unread)</span>}</strong><span>{item.text}</span><small>{item.time ? formatLastActive(item.time) : "Needs attention"}</small></span><ArrowUpRight size={14} /></button>;
        })}
      </div>
      <footer>{storageUnavailable ? "Read status is saved for this session only." : "Read status is saved for this account in this browser."}</footer>
    </section>}
  </div>;
}
