import { useState } from 'react';
import { CartesianGrid, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DeveloperFilters, DeveloperState, EmptyNote, ReadOnlyNote, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { showMetric } from '../../utils/developerConsole';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
export default function DeveloperBkt() {
  const [filters, setFilters] = useState(empty);
  const state = useDeveloperData('bkt', filters);
  const data = state.data;
  const names = new Map((data?.students || []).map(student => [student.id, student.name]));
  const progression = (data?.progression || []).map(point => ({ ...point, label: `${names.get(point.studentId) || 'Student'} · ${point.topic}`, mastery: Math.round(point.mastery * 1000) / 10 }));
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>BKT analytics</h1><p>Probabilities come from stored BKT rows and dated mastery events.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={data?.sections || []} />
    <DeveloperState {...state}>{data && <>
      <p className="developer-threshold">{data.thresholds.explanation}</p>
      {data.datedNote && <p>{data.datedNote}</p>}
      {!data.available && <p className="support-error" role="alert">BKT records are not available yet.</p>}
      <section className="support-panel"><h2>At-risk learners</h2>{!data.atRisk.length ? <EmptyNote>No learner has a recorded probability below {showMetric(data.thresholds.atRisk * 100, 0)}%.</EmptyNote> : <ul>{data.atRisk.map(student => <li key={student.id}>{student.name} · {student.section} · {student.topics.join(', ')}</li>)}</ul>}</section>
      <section className="support-panel"><h2>Mastery progression</h2>{!progression.length ? <EmptyNote>No dated mastery events are stored for these filters.</EmptyNote> : <div className="developer-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={progression}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" hide /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="mastery" name="P(L) %" fill="#08347f" /></BarChart></ResponsiveContainer></div>}</section>
      <section className="support-panel"><h2>Current P(L)</h2>{!data.students.length ? <EmptyNote /> : <div className="support-table-scroll" tabIndex={0} aria-label="BKT probabilities"><table className="support-table"><thead><tr><th>Student</th>{data.students[0].topics.map(topic => <th key={topic.topic}>{topic.topic}</th>)}</tr></thead><tbody>{data.students.map(student => <tr key={student.id}><th>{student.name}<small className="developer-muted">{student.section}</small></th>{student.topics.map(topic => <td key={topic.topic}>{topic.probability === null ? '—' : `${showMetric(topic.probability * 100, 0)}%`}<small className="developer-muted">{topic.source || 'Unobserved'}</small></td>)}</tr>)}</tbody></table></div>}</section>
    </>}</DeveloperState>
  </div>;
}
