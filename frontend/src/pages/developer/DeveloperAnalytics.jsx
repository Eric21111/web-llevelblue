import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DeveloperFilters, DeveloperState, EmptyNote, ReadOnlyNote, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { showMetric, showPercent } from '../../utils/developerConsole';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
export default function DeveloperAnalytics() {
  const [filters, setFilters] = useState(empty);
  const state = useDeveloperData('analytics', filters);
  const data = state.data;
  const scored = (data?.topicPerformance || []).filter(topic => topic.pretest !== null || topic.posttest !== null);
  const sections = (data?.sections || []).filter(section => section.students > 0);
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Learning analytics</h1><p>Charts use stored scores, recorded item responses, and comparable pairs only.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={data?.sections || []} />
    <DeveloperState {...state}>{data && <>
      <p>{data.gainNote}</p>
      <p>Comparable pairs: {data.comparablePairs}. Average gain: {data.averageGain === null ? '—' : `${showMetric(data.averageGain)} points`}.</p>
      <div className="developer-charts">
        <section className="support-panel"><h2>Pre-test and post-test</h2>{!scored.length ? <EmptyNote>No completed scores for these filters.</EmptyNote> : <div className="developer-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={scored}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="topic" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="pretest" name="Pre-test" fill="#08347f" /><Bar dataKey="posttest" name="Post-test" fill="#F2A93B" /></BarChart></ResponsiveContainer></div>}</section>
        <section className="support-panel"><h2>Section completion</h2>{!sections.length ? <EmptyNote>No sections match these filters.</EmptyNote> : <div className="developer-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={sections.map(section => ({ name: section.name, pre: section.pretestCompletion === null ? null : Math.round(section.pretestCompletion * 1000) / 10, post: section.posttestCompletion === null ? null : Math.round(section.posttestCompletion * 1000) / 10 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip /><Bar dataKey="pre" name="Pre-test completion %" fill="#08347f" /><Bar dataKey="post" name="Post-test completion %" fill="#2f6f4e" /></BarChart></ResponsiveContainer></div>}</section>
      </div>
      <section className="support-panel"><h2>Topic mastery from comparable gains</h2>{!data.topicPerformance.some(topic => topic.gain !== null) ? <EmptyNote>No comparable pre/post pairs for these filters.</EmptyNote> : <ul>{data.topicPerformance.filter(topic => topic.gain !== null).map(topic => <li key={topic.topic}>{topic.topic}: {showMetric(topic.gain)} point gain from {topic.pretestCount} pre-test and {topic.posttestCount} post-test records</li>)}</ul>}</section>
      <section className="support-panel"><h2>Question difficulty</h2>{!data.questionDifficulty.length ? <EmptyNote>No item responses are stored for these filters. Scores alone are not turned into question results.</EmptyNote> : <div className="support-table-scroll" tabIndex={0} aria-label="Question difficulty"><table className="support-table"><thead><tr><th>Question</th><th>Topic</th><th>Asked</th><th>Correct</th><th>Missed</th></tr></thead><tbody>{data.questionDifficulty.map(question => <tr key={`${question.topic}-${question.questionId}`}><th>{question.prompt}</th><td>{question.topic || '—'}</td><td>{question.asked}</td><td>{showPercent(question.percentCorrect)}</td><td>{question.missed}</td></tr>)}</tbody></table></div>}</section>
      <section className="support-panel"><h2>Frequently missed questions</h2>{!data.frequentlyMissed.length ? <EmptyNote /> : <ul>{data.frequentlyMissed.map(question => <li key={`${question.topic}-${question.questionId}`}>{question.prompt} · {question.topic} · missed {question.missed} of {question.asked}</li>)}</ul>}</section>
      <section className="support-panel"><h2>Section comparison</h2>{!sections.length ? <EmptyNote /> : <div className="support-table-scroll" tabIndex={0}><table className="support-table"><thead><tr><th>Section</th><th>Students</th><th>Pre-test completion</th><th>Post-test completion</th><th>Average comparable gain</th></tr></thead><tbody>{sections.map(section => <tr key={section.id}><th>{section.name}</th><td>{section.students}</td><td>{showPercent(section.pretestCompletion)}</td><td>{showPercent(section.posttestCompletion)}</td><td>{section.averageGain === null ? '—' : showMetric(section.averageGain)}</td></tr>)}</tbody></table></div>}</section>
    </>}</DeveloperState>
  </div>;
}
