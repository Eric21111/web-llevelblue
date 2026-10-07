import { ArrowUpRight, RefreshCw, AlertCircle, Inbox, CheckCircle2 } from "lucide-react";
import { formatLastActive } from "../../utils/time";
import { initials, formatPercent, masteryPercent, studentId } from "../../utils/dashboard";

export function DashboardCard({ icon: Icon, title, description, action, onAction, children, className = "" }) {
  return <section className={`dash-card ${className}`}><header className="dash-card-header"><div><h2>{Icon && <Icon size={18} aria-hidden="true" />}{title}</h2>{description && <p>{description}</p>}</div>{action && <button className="dash-text-button" onClick={onAction}>{action}<ArrowUpRight size={14} aria-hidden="true" /></button>}</header>{children}</section>;
}
export function DashboardHero({ user, school = false, stats, onNavigate }) {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = user?.firstName || user?.name?.split(" ")[0];
  return <section className={`dash-welcome ${school ? "is-school" : ""}`}><div className="dash-welcome-heading"><div className="dash-hero-copy"><div className="dash-eyebrow">{school ? "SCHOOL BRIEFING" : "YOUR LEARNING STUDIO"} <span> / {now.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div><h1>{greeting}{name ? `, ${name}` : ""}.</h1><p>{school ? "See the whole school. Support every learner." : "Small steps today. Safer habits tomorrow."}</p><button className="dash-primary-action" onClick={() => onNavigate(school ? "/school-progress" : "/follow-ups")}>{school ? "Explore school progress" : "Plan your student check-ins"}<ArrowUpRight size={17} /></button></div></div><div className="dash-metric-strip">{stats.map((stat, index) => <div key={stat.label}><span className="dash-metric-index">0{index + 1}</span><div><span className="dash-metric-label">{stat.label}</span><strong>{stat.value ?? "—"}</strong><small>{stat.note}</small></div></div>)}</div></section>;
}
export function DashboardToolbar({ title = "Your overview", state, children }) {
  return <div className="dash-toolbar"><div><h2>{title}</h2><span className={Object.keys(state.errors).length ? "dash-sync-error" : "dash-sync"}>{Object.keys(state.errors).length ? "Some information is unavailable" : state.loading ? "Loading your information…" : `Updated ${state.updatedAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · refreshes every 30s`}</span></div><div className="dash-toolbar-actions">{children}<button className="dash-button" disabled={state.refreshing} onClick={state.refresh}><RefreshCw size={14} className={state.refreshing ? "dash-spin" : ""} />{state.refreshing ? "Refreshing" : "Refresh"}</button></div></div>;
}
export function DataState({ state, sources, children }) {
  if (state.loading) return <div className="dash-empty" role="status"><RefreshCw size={22} className="dash-spin" /><strong>Loading your information…</strong></div>;
  if (sources.some(key => state.errors[key])) return <div className="dash-empty dash-data-error" role="status"><AlertCircle size={24} /><strong>Information unavailable</strong><p>We couldn’t load this panel. Try refreshing.</p><button className="dash-button" onClick={state.refresh} disabled={state.refreshing}>Try again</button></div>;
  return children;
}
export function EmptyState({ title, text, success = false }) {
  const Icon = success ? CheckCircle2 : Inbox;
  return <div className="dash-empty"><Icon size={25} /><strong>{title}</strong><p>{text}</p></div>;
}
export function AttentionRow({ count, title, text, tone = "teal", onClick }) {
  return <button className="dash-attention-row" onClick={onClick}><span className={`dash-count ${tone}`}>{count}</span><span><strong>{title}</strong><small>{text}</small></span><ArrowUpRight size={16} /></button>;
}
export function SkillBars({ skills }) {
  const available = skills.filter(skill => skill.value !== null);
  if (!available.length) return <EmptyState title="Learning insights will appear here" text="Once students start training, you’ll see which topics need more practice." />;
  return <div className="dash-bars">{skills.map(skill => <div key={skill.name}><div className="dash-bar-label"><span>{skill.name}</span><strong>{formatPercent(skill.value)}</strong></div><div className="dash-bar-track"><span className={skill.value < 40 ? "amber" : ""} style={{ width: `${skill.value ?? 0}%` }} /></div></div>)}<p className="dash-caption">Estimated mastery among students who have started. A score below 40% suggests more practice.</p></div>;
}
export function Participation({ summary }) {
  if (!summary.total) return <EmptyState title="No students yet" text="Participation will appear once students are added to a section." />;
  const groups = [{ label: "Learning in progress", value: summary.progressing, color: "#0fa99c" }, { label: "Needs support", value: summary.needsSupport.length, color: "#eda545" }, { label: "Not started", value: summary.notStarted.length, color: "#d9e0ec" }];
  return <div className="dash-distribution"><div className="dash-distribution-total"><strong>{summary.total}</strong><span>students in this view</span></div><div className="dash-distribution-track" role="img" aria-label={`${summary.total} students: ${groups.map(group => `${group.value} ${group.label}`).join(", ")}`}>{groups.filter(group => group.value > 0).map(group => <span key={group.label} style={{ flex: group.value, background: group.color }} />)}</div><div className="dash-legend">{groups.map(group => <div key={group.label}><i style={{ background: group.color }} /><span>{group.label}</span><strong>{group.value}</strong></div>)}</div></div>;
}
export function StudentActivity({ students }) {
  const recent = students.filter(student => student.lastActive && Number.isFinite(Date.parse(student.lastActive))).sort((a, b) => Date.parse(b.lastActive) - Date.parse(a.lastActive)).slice(0, 5);
  if (!recent.length) return <EmptyState title="No activity recorded yet" text="Students’ most recent training activity will appear here." />;
  return <div className="dash-activity">{recent.map(student => <div key={studentId(student)}><span className="dash-avatar">{initials(student.name)}</span><div><strong>{student.name}</strong><p>Last active · {student.section || "No section"}</p><small>{formatLastActive(student.lastActive)}</small></div></div>)}</div>;
}
export function StudentTable({ students, risk = [], onNavigate, followUps = false }) {
  if (!students.length) return <EmptyState title={followUps ? "No students need follow-up" : "No students to display"} text={followUps ? "No recorded skill is currently flagged below the support threshold for this selection." : "Try another section or add students to your roster."} success={followUps} />;
  const risks = new Map(risk.map(student => [studentId(student), student]));
  return <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Student</th><th>Section</th><th>{followUps ? "Practice needed" : "Mastery"}</th><th>Last active</th><th><span className="dash-sr-only">Action</span></th></tr></thead><tbody>{students.map(student => <tr key={studentId(student)}><td><div className="dash-student-name"><span className="dash-avatar soft">{initials(student.name)}</span><strong>{student.name}</strong></div></td><td>{student.section || "Unassigned"}</td><td>{followUps ? <div className="dash-tags">{(risks.get(studentId(student))?.failingSkills || []).map(skill => <span key={skill}>{skill}</span>)}</div> : formatPercent(masteryPercent(student))}</td><td>{formatLastActive(student.lastActive)}</td><td><button className="dash-text-button" onClick={() => onNavigate(`/roster?search=${encodeURIComponent(student.name || "")}`)} aria-label={`View ${student.name} in student roster`}>View<ArrowUpRight size={13} /></button></td></tr>)}</tbody></table></div>;
}
export function SectionTable({ sections }) {
  if (!sections.length) return <EmptyState title="No sections to compare" text="Section summaries appear once sections or student records are available." />;
  return <div className="dash-table-wrap"><table className="dash-table"><thead><tr><th>Section</th><th>Students</th><th>Active in 7 days</th><th>Avg. mastery</th><th>Needs support</th></tr></thead><tbody>{sections.map(section => <tr key={section.name}><td><strong>{section.name}</strong></td><td>{section.total}</td><td>{section.active}</td><td><span className="dash-mastery-cell">{formatPercent(section.mastery)}<span className="dash-bar-track"><span style={{ width: `${section.mastery ?? 0}%` }} /></span></span></td><td><span className={`dash-pill ${section.needsSupport.length ? "amber" : ""}`}>{section.needsSupport.length}</span></td></tr>)}</tbody></table></div>;
}
