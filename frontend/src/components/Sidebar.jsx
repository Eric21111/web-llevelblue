import { useEffect, useRef, useState } from "react";
import { Shield, X, PanelLeftClose, PanelLeftOpen, ChevronDown, BriefcaseBusiness, ShieldCheck, GraduationCap, Users, ChartColumn, Layers, Code2 } from "lucide-react";
import { workspaceCopy } from "../utils/developerConsole";

export default function Sidebar({ role, user, page, setPage, pages, open, onClose, collapsed, onToggle }) {
  const groups = [...new Set(pages.filter(item => item.group !== 'Workspace').map(item => item.group))];
  const [closed, setClosed] = useState({});
  const [railGroup,setRailGroup]=useState(null);
  const compact=collapsed&&!open;
  const groupIcons={People:Users,Students:Users,Classes:GraduationCap,Insights:ChartColumn,Operations:Layers};
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
  const workspace = workspaceCopy(role,user?.is_head_admin);
  const roleTone = role==='super'?'principal':role==='developer'?'developer':user?.is_head_admin?'head':'teacher';
  const RoleIcon = role==='super'?BriefcaseBusiness:role==='developer'?Code2:user?.is_head_admin?ShieldCheck:GraduationCap;
  const pageButton = (item, index) => <button key={item.path} title={item.label} aria-label={item.label} onClick={() => { setPage(index); setRailGroup(null); if (open) onClose(); }} className={page === index ? "is-active" : ""} aria-current={page === index ? "page" : undefined}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span></button>;
  return <>
    {open && <button className="console-sidebar-backdrop" aria-label="Close navigation" onClick={onClose} />}
    <aside ref={sidebarRef} id="console-sidebar" className={`console-sidebar ${open ? "is-open" : ""}`} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined} aria-label="Workspace navigation">
      <div className="console-brand"><span><Shield size={21} /></span><div>LEVEL<span>BLUE</span></div><button className="console-collapse" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed} onClick={onToggle}>{collapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}</button><button className="console-sidebar-close" aria-label="Close navigation" onClick={onClose}><X size={18} /></button></div>
      <div className={`console-workspace console-role-${roleTone}`}><span className="console-workspace-icon" aria-hidden="true"><RoleIcon size={20}/></span><div className="console-profile-copy"><strong title={user?.name}>{user?.name||workspace.title}</strong><span className="console-profile-role">{workspace.account}</span></div></div>
      <nav aria-label={workspace.nav}>{groups.map((group,index)=>{
        const isOverview=group==='Overview',expanded=isOverview||(compact?railGroup===group:!closed[group]);
        const GroupIcon=groupIcons[group]||pages.find(item=>item.group===group).icon;
        return <div className="console-nav-group" key={group}>
          {!isOverview&&<button className={compact?'console-rail-group':'console-group-toggle'} title={group} aria-label={group} aria-expanded={expanded} aria-controls={`nav-group-${index}`} onClick={()=>compact?setRailGroup(expanded?null:group):setClosed(prev=>({...prev,[group]:expanded}))}>
            {compact?<GroupIcon size={19}/>:<><span>{group}</span><ChevronDown size={13}/></>}
          </button>}
          <div id={`nav-group-${index}`} className={compact&&!isOverview?'console-subnav console-rail-children':'console-subnav'} hidden={!expanded}>{pages.map((item,i)=>item.group===group&&pageButton(item,i))}</div>
        </div>;
      })}</nav>

    </aside>
  </>;
}
