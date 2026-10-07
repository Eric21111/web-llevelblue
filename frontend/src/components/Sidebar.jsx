import { Shield, LogOut, X } from "lucide-react";
import { initials } from "../utils/dashboard";

export default function Sidebar({ role, user, page, setPage, pages, onLogout, open, onClose }) {
  const groups = [...new Set(pages.map(item => item.group))];
  return <>
    {open && <button className="console-sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside id="console-sidebar" className={`console-sidebar ${open ? "is-open" : ""}`}>
      <div className="console-brand"><span><Shield size={21} /></span><div>LEVEL<span>BLUE</span><small>LEARNING WORKSPACE</small></div><button className="console-sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div>
      <div className="console-workspace"><span className="console-workspace-icon">{role === "admin" ? "T" : "SH"}</span><div><strong>{role === "admin" ? "Teacher workspace" : "School head workspace"}</strong><small>Cybersecurity awareness</small></div></div>
      <nav aria-label={role === "admin" ? "Teacher navigation" : "School head navigation"}>{groups.map(group => <div className="console-nav-group" key={group}><h2>{group}</h2>{pages.map((item, index) => item.group === group && <button key={item.path} onClick={() => { setPage(index); onClose(); }} className={page === index ? "is-active" : ""} aria-current={page === index ? "page" : undefined}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span></button>)}</div>)}</nav>
      <div className="console-sidebar-bottom"><div className="console-sidebar-note"><Shield size={18} /><div><strong>Awareness starts here.</strong><span>Small insights. Safer habits.</span></div></div><div className="console-user"><span className="dash-avatar">{user?.imageUrl ? <img src={user.imageUrl} alt="" /> : initials(user?.name || `${user?.firstName || ""} ${user?.lastName || ""}`)}</span><div><strong>{user?.name || user?.firstName || "Your account"}</strong><small>{role === "admin" ? "Teacher" : "School head"}</small></div><button onClick={onLogout} aria-label="Sign out" title="Sign out"><LogOut size={17} /></button></div></div>
    </aside>
  </>;
}
