import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Details, DeveloperFilters, DeveloperState, EmptyNote, ReadOnlyNote, recorded, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { NOT_RECORDED, showMetric } from '../../utils/developerConsole';
import Term from '../../components/Term';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
export default function DeveloperBkt() {
  const [filters, setFilters] = useState(empty);
  const [query, setQuery] = useState('');
  const state = useDeveloperData('bkt', filters);
  const data = state.data;
  const names = new Map((data?.students || []).map(student => [student.id, student.name]));
  const progression = (data?.progression || []).filter(point => typeof point.mastery === 'number' && Number.isFinite(point.mastery)).map(point => ({ ...point, label: `${names.get(point.studentId) || 'Student'} · ${point.topic}`, mastery: Math.round(point.mastery * 1000) / 10 }));
  const students = useMemo(() => (data?.students || []).filter(student => student.name.toLowerCase().includes(query.trim().toLowerCase())), [data, query]);
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1><Term name="bkt">BKT</Term></h1><p>Recorded probabilities and dated mastery events.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={data?.sections || []} />
    <DeveloperState {...state}>{data && <>
      {!data.available && <p className="support-error" role="alert">BKT records are not available yet.</p>}
      <section className="support-panel"><h2><Term name="at-risk">At-risk learners</Term></h2>{!data.atRisk.length ? <EmptyNote>No learner is below {showMetric(data.thresholds.atRisk * 100, 0)}%.</EmptyNote> : <ul>{data.atRisk.map(student => <li key={student.id}>{student.name} · {student.section} · {student.topics.join(', ')}</li>)}</ul>}</section>
      <section className="support-panel"><h2>Mastery progression</h2>{!progression.length ? <EmptyNote>No dated mastery events for these filters.</EmptyNote> : <div className="developer-chart" role="img" aria-label="Dated mastery events"><ResponsiveContainer width="100%" height="100%"><BarChart data={progression}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" hide /><YAxis domain={[0, 100]} unit="%" /><Tooltip formatter={value => [recorded(value, '%'), 'P(L)']} labelFormatter={label => label} /><Legend /><Bar dataKey="mastery" name="P(L)" fill="#08347f" /></BarChart></ResponsiveContainer></div>}</section>
      <section className="support-panel"><h2>Current <Term name="p-known">P(L)</Term></h2>
        <div className="support-filters"><label className="support-search">Find a student<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name" /></label></div>
        {!students.length ? <EmptyNote>{query ? 'No students match this search.' : undefined}</EmptyNote> : <div className="support-table-scroll" tabIndex={0} aria-label="BKT probabilities"><table className="support-table"><thead><tr><th>Student</th>{students[0].topics.map(topic => <th key={topic.topic}>{topic.topic}</th>)}</tr></thead><tbody>{students.map(student => <tr key={student.id}><th>{student.name}<small className="developer-muted">{student.section}</small></th>{student.topics.map(topic => <td key={topic.topic}>{topic.probability === null ? NOT_RECORDED : `${showMetric(topic.probability * 100, 0)}%`}<small className="developer-muted">{topic.probability === null ? '' : topic.source || NOT_RECORDED}</small></td>)}</tr>)}</tbody></table></div>}
      </section>
      <Details title="How to read BKT"><p>{data.thresholds.explanation}</p>{data.datedNote && <p>{data.datedNote}</p>}</Details>
    </>}</DeveloperState>
  </div>;
}
