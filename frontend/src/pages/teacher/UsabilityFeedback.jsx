import { useState } from "react";
import { MessageSquare, SlidersHorizontal, GraduationCap, BookOpen, Bug, UserRound } from "lucide-react";
import { useDashboardData } from "../../hooks/useDashboardData";
import { DashboardToolbar, DashboardCard, DataState, EmptyState } from "../../components/dashboard/DashboardParts";
import { feedbackSummary, studentFeedback, filterFeedback, feedbackSection, feedbackModule } from "../../utils/feedback";
import { formatLastActive } from "../../utils/time";

const SOURCES = { feedback: "/api/usability-feedback" };
const scoreLabel = value => value === null ? "—" : value.toFixed(1);
const ratingCount = count => `${count} rating${count === 1 ? "" : "s"}`;

export default function UsabilityFeedback() {
  const state = useDashboardData(SOURCES);
  const [section, setSection] = useState("");
  const [module, setModule] = useState("");
  const submissions = studentFeedback(state.data.feedback || []);
  const sections = [...new Set(submissions.map(feedbackSection))].sort();
  const modules = [...new Set(submissions.map(feedbackModule))].sort();
  const filtered = filterFeedback(submissions, section, module);
  const summary = feedbackSummary(filtered);
  const byModule = [...new Set(filtered.map(feedbackModule))].sort().map(name => ({ name, ...feedbackSummary(filtered.filter(item => feedbackModule(item) === name)) }));
  const clearFilters = () => { setSection(""); setModule(""); };
  return <div className="dashboard feedback-viewer">
    <div className="feedback-context"><MessageSquare size={19} /><p>Hear from your learners. Explore student ratings, suggestions, and bug reports submitted through the mobile app.</p><span>Read-only</span></div>
    <DashboardToolbar title="Student experience overview" state={state} />
    <div className="feedback-filters"><SlidersHorizontal size={17} aria-hidden="true" /><label><span>Section</span><div className="dash-filter"><GraduationCap size={15} /><select aria-label="Filter by section" value={section} onChange={event => setSection(event.target.value)}><option value="">All sections</option>{section && !sections.includes(section) && <option>{section}</option>}{sections.map(name => <option key={name}>{name}</option>)}</select></div></label><label><span>Module</span><div className="dash-filter"><BookOpen size={15} /><select aria-label="Filter by module" value={module} onChange={event => setModule(event.target.value)}><option value="">All modules</option>{module && !modules.includes(module) && <option>{module}</option>}{modules.map(name => <option key={name}>{name}</option>)}</select></div></label>{(section || module) && <button className="dash-text-button" onClick={clearFilters}>Clear filters</button>}<span className="feedback-result-count" aria-live="polite">{state.loading || state.errors.feedback ? "" : `${filtered.length} student response${filtered.length === 1 ? "" : "s"}`}</span></div>
    <DataState state={state} sources={["feedback"]}>
      {!filtered.length ? <DashboardCard icon={MessageSquare} title={section || module ? "No feedback for this selection" : "Student feedback will appear here"}><EmptyState title={section || module ? "Try another section or module" : "Waiting for student responses"} text={section || module ? "No student submissions match both filters." : "Ratings and comments will appear after students submit feedback from the mobile app."} />{(section || module) && <button className="dash-button" onClick={clearFilters}>Show all student feedback</button>}</DashboardCard> : <>
        <DashboardCard icon={MessageSquare} title="Student satisfaction & difficulty" description="Student survey averages on a 1–5 agreement scale. Higher scores indicate a more positive experience.">
          <div className="feedback-summary"><div><span>Overall satisfaction</span><strong>{scoreLabel(summary.overall.mean)}<small> / 5</small></strong><p>Composite survey average · {summary.overall.count} rated responses</p></div><div><span>Difficulty fit</span><strong>{scoreLabel(summary.difficulty.mean)}<small> / 5</small></strong><p>“The difficulty felt right for me” · {ratingCount(summary.difficulty.count)}</p></div><div><span>Low difficulty-fit ratings</span><strong>{summary.difficulty.count ? summary.lowDifficultyFit : "—"}{summary.difficulty.count > 0 && <small> / {summary.difficulty.count}</small>}</strong><p>Rated 1 or 2 · worth reviewing student comments</p></div><div><span>Written feedback</span><strong>{summary.comments.length}</strong><p>Comments and bug reports in this selection</p></div></div>
          <div className="feedback-question-grid">{summary.questions.map(question => <div key={question.key}><span>{question.label}<small>{ratingCount(question.count)}</small></span><strong>{scoreLabel(question.mean)}<small> / 5</small></strong></div>)}</div>
          <p className="dash-caption">Each response has equal weight. Missing ratings are excluded, not counted as zero. A low difficulty-fit score can mean too easy or too hard; use the comments for context.</p>
        </DashboardCard>
        <DashboardCard icon={BookOpen} title="Experience by module" description="Compare where students report a less positive experience within the selected sections."><div className="dash-table-wrap"><table className="dash-table"><thead><tr><th scope="col">Module</th><th scope="col">Responses</th><th scope="col">Satisfaction / 5</th><th scope="col">Difficulty fit / 5</th><th scope="col">Low difficulty fit</th></tr></thead><tbody>{byModule.map(item => <tr key={item.name}><td><strong>{item.name}</strong></td><td>{item.total}</td><td>{scoreLabel(item.overall.mean)}</td><td>{scoreLabel(item.difficulty.mean)}</td><td><span className={`dash-pill ${item.lowDifficultyFit ? "amber" : ""}`}>{item.difficulty.count ? `${item.lowDifficultyFit} / ${item.difficulty.count}` : "—"}</span></td></tr>)}</tbody></table></div></DashboardCard>
        <DashboardCard icon={MessageSquare} title="Recent Feedback & Comments" description="Student suggestions, learning notes, and reported issues. Newest submissions appear first.">{summary.comments.length ? <div className="feedback-feed">{summary.comments.map((item, index) => <article key={item._id || item.id || index}><div className="feedback-comment-heading"><span className="feedback-author"><UserRound size={16} />{item.studentName || "Student"}</span><time dateTime={Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : undefined}>{Number.isFinite(Date.parse(item.createdAt)) ? formatLastActive(item.createdAt) : "Date not recorded"}</time></div><div className="feedback-tags"><span>{feedbackSection(item)}</span><span>{feedbackModule(item)}</span>{item.feedbackType === "bug" && <span className="feedback-bug"><Bug size={12} />Bug report</span>}</div><p>{item.comments}</p></article>)}</div> : <EmptyState title="No written comments in this selection" text="These students submitted ratings without a comment." />}</DashboardCard>
      </>}
    </DataState>
    <p className="dash-footnote">Only identified student submissions are included. Filters use the section and module recorded with each response; general app feedback is listed separately from module feedback.</p>
  </div>;
}
