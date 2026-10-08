import LearningEvidence from '../../components/LearningEvidence';
import { useState } from "react";
import { Activity, BookOpen, ClipboardCheck, GraduationCap, ShieldAlert, Users, ArrowUpRight, Search } from "lucide-react";
import { useWorkspaceData } from "../../context/WorkspaceDataContext";
import { summarizeStudents } from "../../utils/dashboard";
import { DashboardHero, DashboardToolbar, DashboardCard, DataState, AttentionRow, SkillBars, Participation, StudentActivity, StudentTable, EmptyState } from "../../components/dashboard/DashboardParts";

export default function TeacherHome({ user, onNavigate, followUps = false }) {
  const state = useWorkspaceData();
  const [section, setSection] = useState(() => new URLSearchParams(window.location.search).get("section") || "");
  const followUpPath = section ? `/follow-ups?section=${encodeURIComponent(section)}` : "/follow-ups";
  const [query, setQuery] = useState("");
  const allStudents = state.data.students || [];
  const students = allStudents.filter(student => !section || (student.section || "Unassigned") === section);
  const summary = summarizeStudents(students, state.data.risk || []);
  const sections = [...new Set([...(state.data.sections || []).map(item => item.name), ...allStudents.map(student => student.section || "Unassigned")])].sort();
  const unavailable = state.loading || state.errors.students;
  const riskUnavailable = unavailable || state.errors.risk;
  const needingHelp = summary.needsSupport.filter(student => `${student.name} ${student.section}`.toLowerCase().includes(query.toLowerCase()));
  const unstarted = summary.notStarted.length;
  const lowestSkill = summary.skills.filter(skill => skill.value !== null).sort((a, b) => a.value - b.value)[0];

  return <div className="dashboard dashboard-teacher">
    {!followUps && <DashboardHero onNavigate={onNavigate} user={user} stats={[
      { value: unavailable ? null : summary.total, label: "Students", note: section || "Across available sections" },
      { value: unavailable ? null : summary.active, label: "Active learners", note: "In the last 7 days" },
      { value: riskUnavailable ? null : summary.needsSupport.length, label: "Need support", note: "One or more skills below 40%" },
    ]} />}
    {followUps && <div className="dash-page-intro"><span className="dash-eyebrow">TEACHING & SUPPORT</span><h1>Student follow-ups</h1><button className="learning-button" onClick={() => onNavigate("/interventions")}>Record a review or remediation</button><p>See who needs more practice and open their record to plan your next step.</p></div>}
    <DashboardToolbar title={followUps ? "Students who need your attention" : "Your teaching overview"} state={state}><label className="dash-filter"><span className="dash-sr-only">Filter by section</span><GraduationCap size={15} /><select value={section} onChange={event => setSection(event.target.value)}><option value="">All sections</option>{sections.map(name => <option key={name}>{name}</option>)}</select></label></DashboardToolbar><LearningEvidence compact sectionName={section} onNavigate={onNavigate}/>
    {followUps ? <DashboardCard icon={ShieldAlert} title="Learning support" description="Flagged when at least one recorded skill is below 40% mastery, after learning has started."><label className="dash-search-inline"><Search size={16} /><input aria-label="Search follow-up students" placeholder="Search by student or section…" value={query} onChange={event => setQuery(event.target.value)} /></label><DataState state={state} sources={["students", "risk"]}>{query && !needingHelp.length ? <EmptyState title="No matching students" text="Try a different name or section." /> : <StudentTable students={needingHelp} risk={state.data.risk} onNavigate={onNavigate} followUps />}</DataState></DashboardCard> : <>
      <div className="dash-grid">
        <div className="dash-column">
          <DashboardCard icon={ClipboardCheck} className="dash-priorities" title="Next steps"><DataState state={state} sources={["students", "risk"]}>
            <AttentionRow count={summary.needsSupport.length} title="Students needing support" text="Review skills that need more practice" tone="amber" onClick={() => onNavigate(followUpPath)} />
            <AttentionRow count={unstarted} title="Haven’t started learning" text="Check access and encourage a first session" tone="purple" onClick={() => onNavigate("/roster")} />
            <AttentionRow count={summary.total - summary.active} title="No activity in the last 7 days" text="Export individual learning evidence" onClick={() => onNavigate("/engagement")} />
          </DataState></DashboardCard>
          <DashboardCard icon={Users} className="dash-participation-card" title="Learning momentum" description="A snapshot of the selected students."><DataState state={state} sources={["students", "risk"]}><Participation summary={summary} /></DataState></DashboardCard>
        </div>
        <div className="dash-column">
          <DashboardCard icon={BookOpen} className="dash-focus-card" title="Your next teaching focus" action="Details" onAction={() => onNavigate("/analytics")} description="Understand strengths and learning gaps."><DataState state={state} sources={["students"]}>
            {lowestSkill && <div className="dash-insight"><span>LOWEST MASTERY</span><strong>{lowestSkill.name}<small>{lowestSkill.value}%</small></strong><p>{lowestSkill.value < 70 ? "Consider revisiting this topic in your next lesson." : "Keep reinforcing this skill with continued practice."}</p></div>}
            <SkillBars skills={summary.skills} />
          </DataState></DashboardCard>

        </div>
        <div className="dash-column">
          <DashboardCard icon={Activity} className="dash-activity-card" title="Learner check-ins" description="Latest recorded activity for each student." action="Roster" onAction={() => onNavigate("/roster")}><DataState state={state} sources={["students"]}><StudentActivity students={students} /></DataState></DashboardCard>
          <DashboardCard icon={GraduationCap} className="dash-tools-card" title="Your classroom"><div className="dash-shortcuts"><button onClick={() => onNavigate("/roster")}><Users size={17} /><span>Manage student roster</span><ArrowUpRight size={14} /></button><button onClick={() => onNavigate("/sections")}><GraduationCap size={17} /><span>Organize sections</span><ArrowUpRight size={14} /></button><button onClick={() => onNavigate("/engagement")}><Activity size={17} /><span>Export learning reports</span><ArrowUpRight size={14} /></button></div></DashboardCard>
        </div>
      </div>
      <DashboardCard icon={ShieldAlert} title="Students to check in with" description="Start a conversation around these learning gaps." action="View all" onAction={() => onNavigate(followUpPath)}><DataState state={state} sources={["students", "risk"]}><StudentTable students={summary.needsSupport.slice(0, 5)} risk={state.data.risk} onNavigate={onNavigate} followUps /></DataState></DashboardCard>
    </>}
    <p className="dash-footnote">Based on available student records{section ? ` for ${section}` : " across sections"}. Participation uses recorded activity dates; mastery is an estimate, not a test grade.</p>
  </div>;
}
