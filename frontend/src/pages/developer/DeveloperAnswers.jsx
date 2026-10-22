import { useMemo, useState } from 'react';
import { DeveloperFilters, DeveloperState, EmptyNote, ReadOnlyNote, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { NOT_RECORDED, answerState, compareAttempts, showMetric } from '../../utils/developerConsole';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
function AnswerCells({ answer }) {
  if (!answer) return <td colSpan={4}>{NOT_RECORDED}</td>;
  return <>
    <td>{answer.prompt}</td>
    <td>{answer.selectedAnswer}</td>
    <td>{answer.correctAnswer}</td>
    <td className={answer.correct === true ? 'developer-correct' : answer.correct === false ? 'developer-incorrect' : ''}>{answer.correct === null ? NOT_RECORDED : answer.correct ? 'Correct' : 'Incorrect'}</td>
  </>;
}
export default function DeveloperAnswers() {
  const [filters, setFilters] = useState(empty);
  const [query, setQuery] = useState('');
  const [studentId, setStudentId] = useState('');
  const [leftId, setLeftId] = useState('');
  const [rightId, setRightId] = useState('');
  const directory = useDeveloperData('students', filters);
  const detail = useDeveloperData(studentId ? `students/${encodeURIComponent(studentId)}/assessments` : 'students', studentId ? filters : empty);
  const students = useMemo(() => (directory.data?.students || []).filter(student => student.name.toLowerCase().includes(query.trim().toLowerCase())), [directory.data, query]);
  const report = studentId ? detail.data : null;
  const attempts = report?.student?.id === studentId ? report.attempts || [] : [];
  const left = attempts.find(attempt => attempt.id === leftId);
  const right = attempts.find(attempt => attempt.id === rightId);
  const compared = compareAttempts(left, right);
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Student assessment answers</h1><p>Question responses are shown only when the learning record stored them.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={directory.data?.sections || []} />
    <DeveloperState {...directory}>
      <div className="support-filters"><label className="support-search">Find a student<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name" /></label></div>
      {!students.length ? <EmptyNote>No students match these filters.</EmptyNote> : <div className="support-table-scroll" tabIndex={0} aria-label="Students"><table className="support-table"><thead><tr><th>Student</th><th>Section</th><th>Grade</th><th></th></tr></thead><tbody>{students.map(student => <tr key={student.id}><th>{student.name}</th><td>{student.section}</td><td>{student.gradeLevel || '—'}</td><td><button className="dash-button" aria-pressed={studentId === student.id} onClick={() => { setStudentId(student.id); setLeftId(''); setRightId(''); }}>View answers</button></td></tr>)}</tbody></table></div>}
    </DeveloperState>
    {studentId && <section className="support-panel"><DeveloperState loading={detail.loading} error={detail.error}>{report?.student && <>
      <h2>{report.student.name}</h2>
      <p>{report.note}</p>
      {!attempts.length ? <EmptyNote>No assessment attempts are recorded for these filters.</EmptyNote> : <>
        <div className="developer-compare">
          <label>First attempt<select value={leftId} onChange={event => setLeftId(event.target.value)}><option value="">Select an attempt</option>{attempts.map(attempt => <option key={attempt.id} value={attempt.id}>{attempt.kind} {attempt.attemptNumber} · {attempt.topic} · {attempt.occurredAt?.slice(0, 10) || 'undated'}</option>)}</select></label>
          <label>Compare with<select value={rightId} onChange={event => setRightId(event.target.value)}><option value="">Select an attempt</option>{attempts.map(attempt => <option key={attempt.id} value={attempt.id}>{attempt.kind} {attempt.attemptNumber} · {attempt.topic} · {attempt.occurredAt?.slice(0, 10) || 'undated'}</option>)}</select></label>
        </div>
        <div className="support-table-scroll" tabIndex={0} aria-label="Assessment attempts"><table className="support-table"><thead><tr><th>Attempt</th><th>Topic</th><th>Score</th><th>Instrument</th><th>Completed</th><th>Answers</th></tr></thead><tbody>{attempts.map(attempt => <tr key={attempt.id}><th>{attempt.kind} {attempt.attemptNumber}</th><td>{attempt.topic || '—'}</td><td>{attempt.score === null ? '—' : `${showMetric(attempt.score)}%`}</td><td>{attempt.instrument || '—'}</td><td>{attempt.occurredAt ? attempt.occurredAt.slice(0, 10) : '—'}</td><td>{answerState(attempt)}</td></tr>)}</tbody></table></div>
        {left && <div className="developer-answer"><h3>{left.kind} {left.attemptNumber} answers</h3>{left.answersStatus !== 'recorded' ? <p>{NOT_RECORDED}</p> : <div className="support-table-scroll" tabIndex={0}><table className="support-table"><thead><tr><th>Question</th><th>Selected answer</th><th>Correct answer</th><th>Result</th></tr></thead><tbody>{left.answers.map(answer => <tr key={answer.questionId || answer.prompt}><AnswerCells answer={answer} /></tr>)}</tbody></table></div>}</div>}
        {left && right && <div><h3>Attempt comparison</h3>{!compared.length ? <p>{NOT_RECORDED}</p> : <div className="support-table-scroll" tabIndex={0} aria-label="Attempt comparison"><table className="support-table"><thead><tr><th>Question</th><th>First selected</th><th>First result</th><th>Second selected</th><th>Second result</th></tr></thead><tbody>{compared.map(row => <tr key={row.questionId}><th>{row.left?.prompt && row.left.prompt !== NOT_RECORDED ? row.left.prompt : row.right?.prompt || NOT_RECORDED}</th><td>{row.left?.selectedAnswer || NOT_RECORDED}</td><td>{row.left ? (row.left.correct === null ? NOT_RECORDED : row.left.correct ? 'Correct' : 'Incorrect') : NOT_RECORDED}</td><td>{row.right?.selectedAnswer || NOT_RECORDED}</td><td>{row.right ? (row.right.correct === null ? NOT_RECORDED : row.right.correct ? 'Correct' : 'Incorrect') : NOT_RECORDED}</td></tr>)}</tbody></table></div>}</div>}
        {!!report.comparisons?.length && <div><h3>Comparable pre-test and post-test</h3><ul>{report.comparisons.map(pair => <li key={`${pair.moduleId}-${pair.comparisonKey}`}>{pair.topic || pair.moduleId || 'Student record'}: {showMetric(pair.pre)}% → {showMetric(pair.post)}% ({showMetric(pair.gain)} point gain, {pair.scale})</li>)}</ul></div>}
      </>}
    </>}</DeveloperState></section>}
  </div>;
}
