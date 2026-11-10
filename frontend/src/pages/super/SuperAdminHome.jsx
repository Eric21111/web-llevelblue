import LearningEvidence from '../../components/LearningEvidence';
import Term from '../../components/Term';
import { useState } from "react";
import { Activity, BookOpen, ClipboardCheck, GraduationCap, Users, Layers, Search } from "lucide-react";
import { useWorkspaceData } from "../../context/WorkspaceDataContext";
import { summarizeStudents, sectionSummaries, initials, formatPercent } from "../../utils/dashboard";
import { formatLastActive } from "../../utils/time";
import { DashboardHero, DashboardToolbar, DashboardCard, DataState, DistributionChart, SkillBars, Participation, SectionTable, EmptyState } from "../../components/dashboard/DashboardParts";

export default function SuperAdminHome({ user, onNavigate, progress = false }) {
  const state = useWorkspaceData();
  const [query, setQuery] = useState("");
  const students = state.data.students || [];
  const teachers = (state.data.teachers || []).filter(t=>t.roleLabel!=='Head Admin');
  const content = state.data.content || [];
  const summary = summarizeStudents(students, state.data.risk || []);
  const sections = sectionSummaries(students, state.data.risk || [], state.data.sections || []);
  const invited = teachers.filter(teacher => teacher.status === "Invited").length;
  const active = teachers.filter(teacher => teacher.status === "Active").length;
  const pendingReview = content.filter(item => item.status === 'submitted').length;
  const logs = [...(state.data.logs || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const teachersUnavailable = state.loading || state.errors.teachers;
  const studentsUnavailable = state.loading || state.errors.students;

  const priorities = [
    {label:"Pending invitations", count:teachersUnavailable ? null : invited, path:"/teachers"},
    {label:"Need support", count:studentsUnavailable || state.errors.risk ? null : summary.needsSupport.length, path:"/school-progress"},
    {label:"Awaiting review", count:state.loading || state.errors.content ? null : pendingReview, path:"/content"},
  ];
  const priorityMax = Math.max(1, ...priorities.map(item=>item.count ?? 0));
  return <div className="dashboard dashboard-school">
    {!progress && <DashboardHero onNavigate={onNavigate} user={user} school stats={[
      { value: teachersUnavailable ? null : active, label: "Active teachers", note: "Supporting your learners" },
      { value: studentsUnavailable ? null : summary.total, label: "Students", note: "Across your school" },
      { value: studentsUnavailable || state.errors.sections ? null : sections.length, label: "Sections", note: "Learning together" },
      { value: studentsUnavailable || state.errors.risk ? null : summary.needsSupport.length, label: "Need support", note: "At least one skill below 40%" },
    ]} />}
    {progress && <div className="dash-page-intro"><h1>School Progress</h1><p>Participation and support needs by section.</p></div>}
    <DashboardToolbar title={progress ? "Learning across your school" : "Your school at a glance"} state={state} />

    {progress ? <>
      <div className="dash-summary-grid"><div><span>Active in 7 days</span><strong>{studentsUnavailable ? "—" : `${summary.active} / ${summary.total}`}</strong></div><div><span><Term name="mastery">Average mastery</Term></span><strong>{studentsUnavailable ? "Not recorded" : formatPercent(summary.mastery)}</strong></div><div><span>Need support</span><strong>{studentsUnavailable || state.errors.risk ? "—" : summary.needsSupport.length}</strong><small>At least one skill below 40%</small></div></div>
      <DashboardCard icon={GraduationCap} title="Section comparison" description="Use this view to discuss learning needs with your teachers."><label className="dash-search-inline"><Search size={16} /><input aria-label="Search sections" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find a section…" /></label><DataState state={state} sources={["students", "risk", "sections"]}>{query && !sections.some(section => section.name.toLowerCase().includes(query.toLowerCase())) ? <EmptyState title="No matching sections" text="Try a different section name." /> : <SectionTable sections={sections.filter(section => section.name.toLowerCase().includes(query.toLowerCase()))} />}</DataState></DashboardCard>
      <div className="dash-two-columns"><DashboardCard icon={BookOpen} title="School-wide skill mastery"><DataState state={state} sources={["students"]}><SkillBars skills={summary.skills} /></DataState></DashboardCard><DashboardCard icon={Users} className="dash-participation-card" title="Learning momentum"><DataState state={state} sources={["students", "risk"]}><Participation summary={summary} /></DataState><div className="dash-note"><strong>How to read this</strong><p>Needs support means at least one skill is below 40%. Students who have not started are separate. Missing mastery stays Not recorded.</p></div></DashboardCard></div>
    </> : <>
      <div className="dash-grid">
        <div className="dash-column"><DashboardCard icon={ClipboardCheck} className="dash-priorities" title="School priorities">
          <div className="priority-chart">{priorities.map(({label,count,path})=>
            <button key={path} onClick={()=>onNavigate(path)} aria-label={label+', '+(count ?? 'unavailable')}>
              <span className="priority-plot"><span style={{height:((count ?? 0)/priorityMax*100)+'%'}}/></span>
              <strong>{count ?? '—'}</strong><span>{label}</span>
            </button>
          )}</div>
        </DashboardCard><DashboardCard icon={Users} className="dash-participation-card" title="Learning momentum" description="Learning status across all sections."><DataState state={state} sources={["students", "risk"]}><Participation summary={summary} /></DataState></DashboardCard></div>
        <div className="dash-column"><DashboardCard icon={GraduationCap} className="dash-team-card" title="Teaching team" action="Manage" onAction={() => onNavigate("/teachers")}><DataState state={state} sources={["teachers"]}>
          {!teachers.length ? <EmptyState title="Build your teaching team" text="Add teacher accounts to give educators access to their workspace." /> : <DistributionChart total={teachers.length} unit="Teachers" groups={[
            {label:'Active', value:active, color:'var(--chart-blue)'},
            {label:'Invited', value:invited, color:'var(--chart-amber)'},
            {label:'Other statuses', value:teachers.length-active-invited, color:'var(--chart-muted)'},
          ]}/>}
        </DataState></DashboardCard><DashboardCard icon={Layers} className="dash-content-card" title="Curriculum publishing" action="Review" onAction={() => onNavigate("/content")}><DataState state={state} sources={["content"]}>{content.length ? <div className="dash-bars">{[{status:'submitted',label:'Awaiting review'},{status:'approved',label:'Ready to publish'},{status:'published',label:'Published revisions'}].map(item => <div key={item.status} className="dash-bar-label"><span>{item.label}</span><strong>{content.filter(row=>row.status===item.status).length}</strong></div>)}<p className="dash-caption">Recorded curriculum revisions and their current review state.</p></div> : <EmptyState title="No submissions yet" text="Teacher drafts and review requests will appear here." />}</DataState></DashboardCard></div>
        <div className="dash-column"><DashboardCard icon={Activity} className="dash-activity-card" title="School activity" action="View all" onAction={() => onNavigate("/logs")}><DataState state={state} sources={["logs"]}>{logs.length ? <div className="dash-activity">{logs.slice(0, 3).map((log, index) => <div key={log._id || log.id || index}><span className="dash-avatar">{initials(log.user)}</span><div><strong>{log.user || "System"}</strong><p>{log.action}{log.details ? ` · ${log.details}` : ""}</p><small>{formatLastActive(log.createdAt)}</small></div></div>)}</div> : <EmptyState title="No activity recorded yet" text="Account and content changes will appear here." />}</DataState></DashboardCard></div>
      </div>
      <DashboardCard icon={GraduationCap} title="Learning across sections" description="Participation and support needs, in one place." action="Full overview" onAction={() => onNavigate("/school-progress")}><DataState state={state} sources={["students", "risk", "sections"]}><SectionTable sections={sections.slice(0, 5)} /></DataState></DashboardCard>
    </>}
    <LearningEvidence compact detailsPath="/school-progress" onNavigate={onNavigate}/>
    <p className="dash-footnote"><Term name="mastery">Mastery</Term> uses recorded estimates for learners who have started. Active means activity in the last 7 days.</p>
  </div>;
}
