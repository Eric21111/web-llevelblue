import { useState } from "react";
import { Activity, BookOpen, ClipboardCheck, GraduationCap, Users, Layers, Search } from "lucide-react";
import { useWorkspaceData } from "../../context/WorkspaceDataContext";
import { summarizeStudents, sectionSummaries, initials, formatPercent } from "../../utils/dashboard";
import { formatLastActive } from "../../utils/time";
import { DashboardHero, DashboardToolbar, DashboardCard, DataState, AttentionRow, SkillBars, Participation, SectionTable, EmptyState } from "../../components/dashboard/DashboardParts";

export default function SuperAdminHome({ user, onNavigate, progress = false }) {
  const state = useWorkspaceData();
  const [query, setQuery] = useState("");
  const students = state.data.students || [];
  const teachers = state.data.teachers || [];
  const content = state.data.content || [];
  const summary = summarizeStudents(students, state.data.risk || []);
  const sections = sectionSummaries(students, state.data.risk || [], state.data.sections || []);
  const invited = teachers.filter(teacher => teacher.status === "Invited").length;
  const active = teachers.filter(teacher => teacher.status === "Active").length;
  const belowTarget = content.filter(item => Number(item.authored) < Number(item.target)).length;
  const logs = [...(state.data.logs || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const teachersUnavailable = state.loading || state.errors.teachers;
  const studentsUnavailable = state.loading || state.errors.students;

  return <div className="dashboard dashboard-school">
    {!progress && <DashboardHero onNavigate={onNavigate} user={user} school stats={[
      { value: teachersUnavailable ? null : active, label: "Active teachers", note: "Supporting your learners" },
      { value: studentsUnavailable ? null : summary.total, label: "Students", note: "Across your school" },
      { value: studentsUnavailable || state.errors.sections ? null : sections.length, label: "Sections", note: "Learning together" },
    ]} />}
    {progress && <div className="dash-page-intro"><span className="dash-eyebrow">SCHOOL INSIGHTS</span><h1>School progress</h1><p>Compare participation and learning needs across sections to guide your support.</p></div>}
    <DashboardToolbar title={progress ? "Learning across your school" : "Your school at a glance"} state={state} />
    {progress ? <>
      <div className="dash-summary-grid"><div><span>Students active in 7 days</span><strong>{studentsUnavailable ? "—" : `${summary.active} / ${summary.total}`}</strong><small>Based on last recorded activity</small></div><div><span>Average mastery</span><strong>{studentsUnavailable ? "—" : formatPercent(summary.mastery)}</strong><small>Among learners who have started</small></div><div><span>Students needing support</span><strong>{studentsUnavailable || state.errors.risk ? "—" : summary.needsSupport.length}</strong><small>At least one skill below 40%</small></div></div>
      <DashboardCard icon={GraduationCap} title="Section comparison" description="Use this view to discuss learning needs with your teachers."><label className="dash-search-inline"><Search size={16} /><input aria-label="Search sections" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a section…" /></label><DataState state={state} sources={["students", "risk", "sections"]}>{query && !sections.some(section => section.name.toLowerCase().includes(query.toLowerCase())) ? <EmptyState title="No matching sections" text="Try a different section name." /> : <SectionTable sections={sections.filter(section => section.name.toLowerCase().includes(query.toLowerCase()))} />}</DataState></DashboardCard>
      <div className="dash-two-columns"><DashboardCard icon={BookOpen} title="School-wide skill mastery"><DataState state={state} sources={["students"]}><SkillBars skills={summary.skills} /></DataState></DashboardCard><DashboardCard icon={Users} className="dash-participation-card" title="Learning momentum"><DataState state={state} sources={["students", "risk"]}><Participation summary={summary} /></DataState><div className="dash-note"><strong>How to read these numbers</strong><p>“Needs support” identifies learners with at least one flagged skill. Students who haven’t started are shown separately. Missing mastery data appears as a dash.</p></div></DashboardCard></div>
    </> : <>
      <div className="dash-grid">
        <div className="dash-column"><DashboardCard icon={ClipboardCheck} className="dash-priorities" title="School priorities">
          <DataState state={state} sources={["teachers"]}><AttentionRow count={invited} title="Teacher invitations pending" text="Help teachers complete their first sign-in" tone="amber" onClick={() => onNavigate("/teachers")} /></DataState>
          <DataState state={state} sources={["students", "risk"]}><AttentionRow count={summary.needsSupport.length} title="Learners needing support" text="See which sections need a closer look" tone="purple" onClick={() => onNavigate("/school-progress")} /></DataState>
          <DataState state={state} sources={["content"]}><AttentionRow count={belowTarget} title="Topics below content target" text="Review question coverage in the content bank" onClick={() => onNavigate("/content")} /></DataState>
        </DashboardCard><DashboardCard icon={Users} className="dash-participation-card" title="Learning momentum" description="Learning status across all sections."><DataState state={state} sources={["students", "risk"]}><Participation summary={summary} /></DataState></DashboardCard></div>
        <div className="dash-column"><DashboardCard icon={GraduationCap} className="dash-team-card" title="Teaching team" action="Manage" onAction={() => onNavigate("/teachers")}><DataState state={state} sources={["teachers"]}>
          {!teachers.length ? <EmptyState title="Build your teaching team" text="Add teacher accounts to give educators access to their workspace." /> : <><div className="dash-big-number">{teachers.length}<span>teacher accounts</span></div><div className="dash-bars">{[{ label: "Active", value: active }, { label: "Invited", value: invited }, { label: "Other statuses", value: teachers.length - active - invited }].map(item => <div key={item.label}><div className="dash-bar-label"><span>{item.label}</span><strong>{item.value}</strong></div><div className="dash-bar-track"><span style={{ width: `${item.value / teachers.length * 100}%` }} /></div></div>)}</div><p className="dash-caption">Invited teachers complete account setup at their first sign-in.</p></>}
        </DataState></DashboardCard><DashboardCard icon={Layers} className="dash-content-card" title="Content readiness" action="Manage" onAction={() => onNavigate("/content")}><DataState state={state} sources={["content"]}>{content.length ? <div className="dash-bars">{content.map(item => <div key={item.skill}><div className="dash-bar-label"><span>{item.skill}</span><strong>{Number(item.authored) || 0}<small> / {Number(item.target) || 0}</small></strong></div><div className="dash-bar-track"><span style={{ width: `${Number(item.target) > 0 ? Math.min(100, Number(item.authored) / Number(item.target) * 100) : 0}%` }} /></div></div>)}<p className="dash-caption">Authored questions compared with the target for each topic.</p></div> : <EmptyState title="No content records yet" text="Review the content bank to start tracking topic coverage." />}</DataState></DashboardCard></div>
        <div className="dash-column"><DashboardCard icon={Activity} className="dash-activity-card" title="School activity" action="View all" onAction={() => onNavigate("/logs")}><DataState state={state} sources={["logs"]}>{logs.length ? <div className="dash-activity">{logs.slice(0, 5).map((log, index) => <div key={log._id || log.id || index}><span className="dash-avatar">{initials(log.user)}</span><div><strong>{log.user || "System"}</strong><p>{log.action}{log.details ? ` · ${log.details}` : ""}</p><small>{formatLastActive(log.createdAt)}</small></div></div>)}</div> : <EmptyState title="No activity recorded yet" text="Account and content changes will appear here." />}</DataState></DashboardCard></div>
      </div>
      <DashboardCard icon={GraduationCap} title="Learning across sections" description="Participation and support needs, in one place." action="Full overview" onAction={() => onNavigate("/school-progress")}><DataState state={state} sources={["students", "risk", "sections"]}><SectionTable sections={sections.slice(0, 5)} /></DataState></DashboardCard>
    </>}
    <p className="dash-footnote">Mastery reflects recorded skill estimates for learners who have started. Participation is based on activity in the last 7 days.</p>
  </div>;
}
