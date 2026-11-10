import { useEffect, useRef, useState } from "react";
import { Search, Menu, HelpCircle, ChevronRight, X, Settings, LogOut, Moon, Sun } from "lucide-react";
import Sidebar from "./Sidebar";
import { useWorkspaceData } from "../context/WorkspaceDataContext";
import LogoutDialog from "./LogoutDialog";
import Notifications from "./Notifications";
import { initials } from "../utils/dashboard";
import { workspaceCopy } from "../utils/developerConsole";
import "../styles/console.css";
import "../styles/workspace-refresh.css";
import "../styles/workspace-controls.css";

export default function ConsoleLayout({ user, role, pages, pageIndex, currentPath, onNavigate, onLogout, children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('levelblue-sidebar-collapsed') === 'true'; } catch { return false; } });
  const toggleSidebar = () => setCollapsed(previous => { try { localStorage.setItem('levelblue-sidebar-collapsed', String(!previous)); } catch { /* Navigation still works when storage is unavailable. */ } return !previous; });
  const [theme,setTheme]=useState(()=>{try{return localStorage.getItem('levelblue-theme')==='light'?'light':'dark';}catch{return 'dark';}});
  function chooseTheme(value){
    setTheme(value);
    try{localStorage.setItem('levelblue-theme',value);}catch{/* Still apply the preference for this visit. */}
  }
  const [search, setSearch] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const profileButton = useRef(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const mainRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const helpRef = useRef(null);
  const logoutTriggerRef = useRef(null);
  const {data,errors} = useWorkspaceData();
  const assignedSections=(data.sections||[]).map(section=>`${section.gradeLevel||'Grade unconfirmed'} · ${section.name}`).join('; ');
  const assignmentText=errors.sections?'Assignments unavailable':!data.sections?'Loading assignments…':assignedSections||'No assigned sections';
  const page = pages[pageIndex];
  const workspace = workspaceCopy(role,user?.is_head_admin);
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
  useEffect(() => { mainRef.current?.scrollTo(0, 0); setSearch(""); setHelpOpen(false); setProfileOpen(false); }, [currentPath]);
  useEffect(() => {
    const onKey = event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !logoutOpen && !menuOpen) { event.preventDefault(); searchRef.current?.querySelector('input')?.focus(); } if (event.key === "Escape" && !logoutOpen) { if (menuOpen) requestAnimationFrame(() => menuRef.current?.focus()); setMenuOpen(false); setSearch(""); setHelpOpen(false); if(profileOpen)profileButton.current?.focus(); setProfileOpen(false); } };
    const onOutside = event => {
      if (!profileRef.current?.contains(event.target)) setProfileOpen(false);
      if (!searchRef.current?.contains(event.target)) setSearch("");
      if (!helpRef.current?.contains(event.target)) setHelpOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onOutside); };
  }, [menuOpen, logoutOpen, profileOpen]);
  const matches = pages.filter(item => item.label.toLowerCase().includes(search.trim().toLowerCase()));
  return <div data-theme={theme} className={`console-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <a className="console-skip" href="#console-main">Skip to main content</a>
    <Sidebar collapsed={collapsed} onToggle={toggleSidebar} role={role} user={user} pages={pages} page={pageIndex} setPage={index => onNavigate(pages[index].path)} open={menuOpen} onClose={() => { setMenuOpen(false); requestAnimationFrame(() => menuRef.current?.focus()); }} />
    <div className="console-workarea" inert={menuOpen ? true : undefined}><header className="console-topbar">
      <button ref={menuRef} className="console-menu-button" aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="console-sidebar" onClick={() => setMenuOpen(!menuOpen)}><Menu size={20} /></button>
      <div className="console-page-context"><div className="console-breadcrumb"><span>{workspace.crumb}</span><ChevronRight size={13} /><strong>{page.label}</strong></div>{role==='admin'&&<small className="console-assignment" title={assignmentText}>Assigned: {assignmentText}</small>}</div>
      <div className="console-topbar-actions"><div className="console-search" ref={searchRef}><Search size={16} /><input aria-label="Find a page" placeholder="Find a page…" value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && matches.length === 1) { onNavigate(matches[0].path); setSearch(""); } }} />{search && <div className="console-search-results">{matches.length ? matches.map(item => <button key={item.path} onClick={() => { onNavigate(item.path); setSearch(""); }}><item.icon size={15} />{item.label}<ChevronRight size={13} /></button>) : <p>No matching pages.</p>}</div>}</div>
        <div className="console-help" ref={helpRef}><button className="console-icon-button" aria-label="Workspace help" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}><HelpCircle size={19} /></button>{helpOpen && <div className="console-help-popover"><strong>{workspace.helpTitle}</strong><p>{workspace.help}</p><button className="dash-text-button" onClick={() => setHelpOpen(false)}>Got it<X size={12} /></button></div>}</div>
        <Notifications key={`${role}:${user?._id ?? user?.id ?? user?.email ?? "session"}`} user={user} role={role} currentPath={currentPath} onNavigate={onNavigate} />
        <div className="console-profile-menu" ref={profileRef} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setProfileOpen(false); }}>
          <button ref={profileButton} className="console-profile-button" aria-label="Account menu" aria-expanded={profileOpen} aria-controls="account-options" onClick={() => setProfileOpen(value => !value)}>
            <span className="dash-avatar">{user?.imageUrl ? <img src={user.imageUrl} alt="" /> : initials(user?.name || user?.firstName)}</span>
          </button>
          {profileOpen && <div id="account-options" className="console-account-options" role="group" aria-label="Account actions">
            <strong>{user?.name || user?.firstName || 'Your account'}</strong>
            <small>{workspace.account}</small>
            <div className="console-theme-choice" role="group" aria-label="Appearance">
              <button type="button" aria-pressed={theme==='dark'} onClick={()=>chooseTheme('dark')}><Moon size={14}/>Dark</button>
              <button type="button" aria-pressed={theme==='light'} onClick={()=>chooseTheme('light')}><Sun size={14}/>Light</button>
            </div>
            <button onClick={() => { setProfileOpen(false); onNavigate('/settings'); }}><Settings size={16} aria-hidden="true" />Account settings</button>
            <button onClick={() => { logoutTriggerRef.current = profileButton.current; setProfileOpen(false); setLogoutOpen(true); }}><LogOut size={16} aria-hidden="true" />Sign out</button>
          </div>}
        </div>
      </div>
    </header><main id="console-main" ref={mainRef} tabIndex={-1} className="console-main">{!["/dashboard", "/follow-ups", "/school-progress", "/analytics", "/engagement", "/reports", "/interventions", "/sections", "/roster", "/teachers", "/developers", "/password-assistance", "/enrollment", "/logs", "/teacher-activity", "/content", "/answers", "/bkt", "/monitoring"].includes(page.path) && <div className="dash-page-intro"><h1>{page.label}</h1><p>{page.description}</p></div>}{children}</main></div>
    {logoutOpen && <LogoutDialog onCancel={() => setLogoutOpen(false)} onConfirm={() => { setLogoutOpen(false); onLogout(); }} />}
  </div>;
}
