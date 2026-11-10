import Skeleton from '../Skeleton';
import {useState} from 'react';
import {DashboardPeriodActivity,localDate} from './DashboardPeriod';
import { AlertCircle, Inbox, CheckCircle2, Users, Activity, GraduationCap, ShieldAlert, School } from "lucide-react";
import DashboardExports from './DashboardExports';
import { formatLastActive } from "../../utils/time";
import { initials, formatPercent, masteryPercent, studentId } from "../../utils/dashboard";

export function DashboardCard({ icon: Icon, title, description, action, onAction, children, className = "" }) {
  return <section className={`dash-card ${className}`}><header className="dash-card-header"><div><h2>{Icon && <Icon size={18} aria-hidden="true" />}{title}</h2>{description && <p>{description}</p>}</div>{action && <button className="dash-text-button" onClick={onAction}>{action}</button>}</header>{children}</section>;
}
export function DashboardHero({ user, school = false, stats, sectionName='' }) {
  const [date,setDate]=useState(localDate),[period,setPeriod]=useState('day');
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = user?.firstName || user?.name?.split(" ")[0];
  const metrics = school
    ? [[GraduationCap,'faculty'],[Users,'learners'],[School,'sections'],[ShieldAlert,'support']]
    : [[Users,'learners'],[Activity,'faculty'],[ShieldAlert,'support'],[School,'sections']];
  return <section className={`dash-welcome ${school ? "is-school" : ""}`}>
    <div className="dash-overview-heading"><div><h1>Dashboard</h1><p>{greeting}{name ? ', ' + name : ''}. {school ? 'Here’s how learning is progressing across your school.' : 'Here’s where your classroom needs you today.'}</p></div><DashboardExports sectionName={sectionName} date={date} period={period} onDate={setDate} onPeriod={setPeriod}/></div>
    <div className="dash-overview-metrics">{stats.map((stat,index) => { const [Icon,tone]=metrics[index]; return <article className={"metric-"+tone} key={stat.label}><div className="dash-overview-metric-label"><span>{stat.label}</span><Icon size={18} aria-hidden="true"/></div><strong>{stat.value ?? '—'}</strong><small>{stat.note}</small></article>; })}</div>
    <DashboardPeriodActivity date={date} period={period} sectionName={sectionName}/>
  </section>;
}
export function DashboardToolbar({ title = "Your overview", state, children }) {
  return <div className="dash-toolbar"><div><h2>{title}</h2><span className={Object.keys(state.errors).length ? "dash-sync-error" : "dash-sync"}>{Object.keys(state.errors).length ? "Some information is unavailable" : state.loading ? "Loading your information…" : `Updated ${state.updatedAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}</span></div><div className="dash-toolbar-actions">{children}</div></div>;
}
export function DataState({ state, sources, children }) {
  if (state.loading) return <Skeleton label="Loading dashboard information"/>;
  if (sources.some(key => state.errors[key])) return <div className="dash-empty dash-data-error" role="status"><AlertCircle size={24} /><strong>Information unavailable</strong><p>We couldn’t load this panel. Try refreshing.</p><button className="dash-button" onClick={state.refresh} disabled={state.refreshing}>Try again</button></div>;
  return children;
}
export function EmptyState({ title, text, success = false }) {
  const Icon = success ? CheckCircle2 : Inbox;
  return <div className="dash-empty"><Icon size={25} /><strong>{title}</strong><p>{text}</p></div>;
}
export function AttentionRow({ count, title, text, tone = "teal", onClick }) {
  return <button className="dash-attention-row" onClick={onClick}><span className={`dash-count ${tone}`}>{count}</span><span><strong>{title}</strong><small>{text}</small></span></button>;
}
export function SkillBars({ skills }) {
  const available = skills.filter(skill => skill.value !== null);
  if (!available.length) return <EmptyState title="Learning insights will appear here" text="Once students start training, you’ll see which topics need more practice." />;
  return <div className="dash-bars">{skills.map(skill => <div key={skill.name}><div className="dash-bar-label"><span>{skill.name}</span><strong>{formatPercent(skill.value)}</strong></div><div className="dash-bar-track">{skill.value == null ? null : <span className={skill.value < 40 ? "amber" : ""} style={{ width: `${skill.value}%` }} />}</div></div>)}<p className="dash-caption">Recorded mastery for students who have started. Below 40% needs more practice.</p></div>;
}
export function Participation({ summary }) {
  if (!summary.total) return <EmptyState title="No students yet" text="Participation will appear once students are added to a section." />;
  const groups = [{ label: "Learning in progress", value: summary.progressing, color: "var(--chart-blue)" }, { label: "Needs support", value: summary.needsSupport.length, color: "var(--chart-amber)" }, { label: "Not started", value: summary.notStarted.length, color: "var(--chart-muted)" }];
  return <DistributionChart groups={groups} total={summary.total} unit="Students"/>;
}

export function DistributionChart({groups, total, unit}) {
  let offset = 0;
  const segments = groups.map(group => {
    const length = total ? group.value / total * 100 : 0;
    const start = offset;
    offset += length;
    return {...group, start, length};
  });
  return <div className="distribution-chart">
    <div className="dash-donut">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-track" cx="50" cy="50" r="42"/>
        {segments.filter(segment=>segment.length>0).map(segment=>
          <circle key={segment.label} cx="50" cy="50" r="42" pathLength="100"
            stroke={segment.color} strokeDasharray={segment.length+' '+(100-segment.length)} strokeDashoffset={-segment.start}/>
        )}
      </svg>
      <span><strong>{total}</strong>{unit}</span>
    </div>
    <dl>{groups.map(group=><div key={group.label}><dt><i style={{background:group.color}}/>{group.label}</dt><dd>{group.value}</dd></div>)}</dl>
  </div>;
}
export function StudentActivity({ students }) {
  const recent = students.filter(student => student.lastActive && Number.isFinite(Date.parse(student.lastActive))).sort((a, b) => Date.parse(b.lastActive) - Date.parse(a.lastActive)).slice(0, 5);
  if (!recent.length) return <EmptyState title="No activity recorded yet" text="Students’ most recent training activity will appear here." />;
  return <div className="dash-activity">{recent.map(student => <div key={studentId(student)}><span className="dash-avatar">{initials(student.name)}</span><div><strong>{student.name}</strong><p>Last active · {student.section || "No section"}</p><small>{formatLastActive(student.lastActive)}</small></div></div>)}</div>;
}
export function StudentTable({ students, risk = [], onNavigate, followUps = false }) {
  if (!students.length) return <EmptyState title={followUps ? "No students need follow-up" : "No students to display"} text={followUps ? "No recorded skill is currently flagged below the support threshold for this selection." : "Try another section or add students to your roster."} success={followUps} />;
  const risks = new Map(risk.map(student => [studentId(student), student]));
  return <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Student</th><th>Section</th><th>{followUps ? "Practice needed" : "Mastery"}</th><th>Last active</th><th><span className="dash-sr-only">Action</span></th></tr></thead><tbody>{students.map(student => <tr key={studentId(student)}><td><div className="dash-student-name"><span className="dash-avatar soft">{initials(student.name)}</span><strong>{student.name}</strong></div></td><td>{student.section || "Unassigned"}</td><td>{followUps ? <div className="dash-tags">{(risks.get(studentId(student))?.failingSkills || []).map(skill => <span key={skill}>{skill}</span>)}</div> : formatPercent(masteryPercent(student))}</td><td>{formatLastActive(student.lastActive)}</td><td><button className="dash-text-button" onClick={() => onNavigate(`/roster?search=${encodeURIComponent(student.name || "")}`)} aria-label={`View ${student.name} in student roster`}>View</button></td></tr>)}</tbody></table></div>;
}
export function SectionTable({ sections }) {
  if (!sections.length) return <EmptyState title="No sections to compare" text="Section summaries appear once sections or student records are available." />;
  return <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Section</th><th>Students</th><th>Active in 7 days</th><th>Avg. mastery</th><th>Needs support</th></tr></thead><tbody>{sections.map(section => <tr key={section.name}><td><strong>{section.name}</strong></td><td>{section.total}</td><td>{section.active}</td><td><span className="dash-mastery-cell">{formatPercent(section.mastery)}<span className="dash-bar-track">{section.mastery == null ? null : <span style={{ width: `${section.mastery}%` }} />}</span></span></td><td><span className={`dash-pill ${section.needsSupport.length ? "amber" : ""}`}>{section.needsSupport.length}</span></td></tr>)}</tbody></table></div>;
}
