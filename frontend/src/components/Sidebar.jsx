import { useEffect, useRef, useState } from "react";
import { Shield, X, PanelLeftClose, PanelLeftOpen, ChevronDown } from "lucide-react";

export default function Sidebar({ role, page, setPage, pages, open, onClose, collapsed, onToggle }) {
  const groups = [...new Set(pages.filter(item => item.group !== 'Workspace').map(item => item.group))];
  const [closed, setClosed] = useState({});
  const sidebarRef = useRef(null);
  useEffect(() => { setClosed(previous => ({...previous, [pages[page]?.group]: false})); }, [page, pages[page]?.group]);
  useEffect(() => {
    if (!open) return;
    const sidebar = sidebarRef.current;
    const frame = requestAnimationFrame(() => sidebar.querySelector('.console-sidebar-close')?.focus());
    // A pointer click can finish after the first focus call while the drawer animates.
    const focusTimer = setTimeout(() => { if (!sidebar.contains(document.activeElement)) sidebar.querySelector('.console-sidebar-close')?.focus(); }, 220);
    const trap = event => {
      if (event.key !== 'Tab') return;
      const buttons = [...sidebar.querySelectorAll('button')].filter(button => button.getClientRects().length);
      const first = buttons[0], last = buttons.at(-1);
      if (!sidebar.contains(document.activeElement)) { event.preventDefault(); first?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { cancelAnimationFrame(frame); clearTimeout(focusTimer); document.removeEventListener('keydown', trap); };
  }, [open]);
  const pageButton = (item, index) => <button key={item.path} title={item.label} aria-label={item.label} onClick={() => { setPage(index); if (open) onClose(); }} className={page === index ? "is-active" : ""} aria-current={page === index ? "page" : undefined}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span></button>;
  return <>
    {open && <button className="console-sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside ref={sidebarRef} id="console-sidebar" className={`console-sidebar ${open ? "is-open" : ""}`} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Workspace navigation">
      <div className="console-brand"><span><Shield size={21} /></span><div>LEVEL<span>BLUE</span></div><button className="console-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button><button className="console-sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div>
      <div className="console-workspace"><span className="console-workspace-icon">{role === "admin" ? "T" : "SH"}</span><div><strong>{role === "admin" ? "Teacher workspace" : "School head workspace"}</strong><small>Cybersecurity awareness</small></div></div>
      <nav aria-label={role === "admin" ? "Teacher navigation" : "School head navigation"}>{groups.map((group, groupIndex) => <div className="console-nav-group" key={group}>{group !== 'Overview' && <button className="console-group-toggle" aria-expanded={!closed[group] || (collapsed && !open)} aria-controls={`nav-group-${groupIndex}`} onClick={() => { if (collapsed && !open) onToggle(); setClosed(previous => ({...previous, [group]: !previous[group]})); }}><span>{group}</span><ChevronDown size={13}/></button>}<div id={`nav-group-${groupIndex}`} hidden={group !== 'Overview' && closed[group] && !(collapsed && !open)}>{pages.map((item, index) => item.group === group && pageButton(item, index))}</div></div>)}</nav>

    </aside>
  </>;
}
