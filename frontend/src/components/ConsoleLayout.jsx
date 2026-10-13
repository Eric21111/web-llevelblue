import { useEffect, useRef, useState } from "react";
import { Search, Menu, HelpCircle, ChevronRight, X } from "lucide-react";
import Sidebar from "./Sidebar";
import LogoutDialog from "./LogoutDialog";
import Notifications from "./Notifications";
import { initials } from "../utils/dashboard";
import "../styles/console.css";
import "../styles/workspace-refresh.css";

export default function ConsoleLayout({ user, role, pages, pageIndex, currentPath, onNavigate, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('levelblue-sidebar-collapsed') === 'true'; } catch { return false; } });
  const toggleSidebar = () => setCollapsed(previous => { try { localStorage.setItem('levelblue-sidebar-collapsed', String(!previous)); } catch { /* Navigation still works when storage is unavailable. */ } return !previous; });
  const [search, setSearch] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const mainRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const helpRef = useRef(null);
  const logoutTriggerRef = useRef(null);
  const page = pages[pageIndex];
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 901px)');
    const closeDrawer = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener('change', closeDrawer);
    return () => desktop.removeEventListener('change', closeDrawer);
  }, []);
  useEffect(() => {
    if (!logoutOpen && logoutTriggerRef.current) {
      logoutTriggerRef.current.focus();
      logoutTriggerRef.current = null;
    }
  }, [logoutOpen]);
  useEffect(() => { mainRef.current?.scrollTo(0, 0); setSearch(""); setHelpOpen(false); }, [currentPath]);
  useEffect(() => {
    const onKey = event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !logoutOpen && !menuOpen) { event.preventDefault(); searchRef.current?.querySelector('input')?.focus(); } if (event.key === "Escape" && !logoutOpen) { if (menuOpen) requestAnimationFrame(() => menuRef.current?.focus()); setMenuOpen(false); setSearch(""); setHelpOpen(false); } };
    const onOutside = event => {
      if (!searchRef.current?.contains(event.target)) setSearch("");
      if (!helpRef.current?.contains(event.target)) setHelpOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onOutside); };
  }, [menuOpen, logoutOpen]);
  const matches = pages.filter(item => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className={`console-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <a className="console-skip" href="#console-main">Skip to main content</a>
    <Sidebar collapsed={collapsed} onToggle={toggleSidebar} role={role} user={user} pages={pages} page={pageIndex} setPage={index => onNavigate(pages[index].path)} onLogout={() => { logoutTriggerRef.current = menuOpen ? menuRef.current : document.activeElement; setMenuOpen(false); setLogoutOpen(true); }} open={menuOpen} onClose={() => { setMenuOpen(false); requestAnimationFrame(() => menuRef.current?.focus()); }} />
    <div className="console-workarea" inert={menuOpen ? true : undefined}><header className="console-topbar">
      <button ref={menuRef} className="console-menu-button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="console-sidebar" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
      <div className="console-breadcrumb"><span>{role === "admin" ? "Teaching" : "Administration"}</span><ChevronRight size={13} /><strong>{page.label}</strong></div>
      <div className="console-topbar-actions"><div className="console-search" ref={searchRef}><Search size={16} /><input aria-label="Find a page" placeholder="Find a page…" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && matches.length === 1) { onNavigate(matches[0].path); setSearch(""); } }} />{search && <div className="console-search-results">{matches.length ? matches.map(item => <button key={item.path} onClick={() => { onNavigate(item.path); setSearch(""); }}><item.icon size={15} />{item.label}<ChevronRight size={13} /></button>) : <p>No matching pages.</p>}</div>}</div>
        <div className="console-help" ref={helpRef}><button className="console-icon-button" aria-label="Workspace help" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}><HelpCircle size={19} /></button>{helpOpen && <div className="console-help-popover"><strong>Your {role === "admin" ? "teacher" : "school head"} workspace</strong><p>{role === "admin" ? "Start with student follow-ups to find learning gaps. Use the roster for student records and sections to organize classes." : "Manage teacher accounts and training content, then use School Progress to compare participation and support needs."}</p><button className="dash-text-button" onClick={() => setHelpOpen(false)}>Got it<X size={12} /></button></div>}</div>
        <Notifications key={`${role}:${user?._id ?? user?.id ?? user?.email ?? "session"}`} user={user} role={role} currentPath={currentPath} onNavigate={onNavigate} />
        <button className="console-profile-button" aria-label="Open account settings" onClick={() => onNavigate("/settings")}><span className="dash-avatar">{initials(user?.name || user?.firstName)}</span></button>
      </div>
    </header><main id="console-main" ref={mainRef} tabIndex={-1} className="console-main">{!["/dashboard", "/follow-ups", "/school-progress", "/analytics", "/engagement", "/reports", "/interventions", "/sections", "/content"].includes(page.path) && <div className="dash-page-intro"><span className="dash-eyebrow">{page.group}</span><h1>{page.label}</h1><p>{page.description}</p></div>}{children}</main></div>
    {logoutOpen && <LogoutDialog onCancel={() => setLogoutOpen(false)} onConfirm={() => { setLogoutOpen(false); onLogout(); }} />}
  </div>;
}
