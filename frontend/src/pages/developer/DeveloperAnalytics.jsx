import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Details, DeveloperFilters, DeveloperState, EmptyNote, ReadOnlyNote, recorded, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { NOT_RECORDED, showMetric, showPercent } from '../../utils/developerConsole';
import Term from '../../components/Term';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
export default function DeveloperAnalytics() {
  const [filters, setFilters] = useState(empty);
  const state = useDeveloperData('analytics', filters);
  const data = state.data;
  const scored = (data?.topicPerformance || []).filter(topic => topic.pretest !== null || topic.posttest !== null).map(topic => ({ ...topic, pretest: topic.pretest ?? undefined, posttest: topic.posttest ?? undefined }));
  const sections = (data?.sections || []).filter(section => section.students > 0);
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Learning analytics</h1><p>Stored scores and comparable pairs only.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={data?.sections || []} />
    <DeveloperState {...state}>{data && <>
      <p><Term name="learning-gain">Learning gain</Term>: {data.comparablePairs} comparable pair{data.comparablePairs === 1 ? '' : 's'} · average {data.averageGain === null ? NOT_RECORDED : `${showMetric(data.averageGain)} points`}.</p>
      <div className="developer-charts">
        <section className="support-panel"><h2>Pre-test and post-test</h2>{!scored.length ? <EmptyNote>No completed scores for these filters.</EmptyNote> : <div className="developer-chart" role="img" aria-label="Average pre-test and post-test by topic"><ResponsiveContainer width="100%" height="100%"><BarChart data={scored}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="topic" /><YAxis domain={[0, 100]} unit="%" /><Tooltip formatter={value => [recorded(value, '%')]} /><Legend /><Bar dataKey="pretest" name="Pre-test" fill="#08347f" /><Bar dataKey="posttest" name="Post-test" fill="#F2A93B" /></BarChart></ResponsiveContainer></div>}</section>
        <section className="support-panel"><h2>Section completion</h2>{!sections.length ? <EmptyNote>No sections match these filters.</EmptyNote> : <div className="developer-chart" role="img" aria-label="Pre-test and post-test completion by section"><ResponsiveContainer width="100%" height="100%"><BarChart data={sections.map(section => ({ name: section.name, pre: section.pretestCompletion === null ? undefined : Math.round(section.pretestCompletion * 1000) / 10, post: section.posttestCompletion === null ? undefined : Math.round(section.posttestCompletion * 1000) / 10 }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis domain={[0, 100]} unit="%" /><Tooltip formatter={value => [recorded(value, '%')]} /><Legend /><Bar dataKey="pre" name="Pre-test completion" fill="#08347f" /><Bar dataKey="post" name="Post-test completion" fill="#2f6f4e" /></BarChart></ResponsiveContainer></div>}</section>
      </div>
      <section className="support-panel"><h2><Term name="mastery">Topic mastery</Term></h2>{!data.topicPerformance.some(topic => topic.gain !== null) ? <EmptyNote>No comparable pre/post pairs for these filters.</EmptyNote> : <ul>{data.topicPerformance.filter(topic => topic.gain !== null).map(topic => <li key={topic.topic}>{topic.topic}: {showMetric(topic.gain)} point gain · {topic.pretestCount} pre-tests · {topic.posttestCount} post-tests</li>)}</ul>}</section>
      <Details title={`Question difficulty (${data.questionDifficulty.length})`} open={data.questionDifficulty.length > 0}>{!data.questionDifficulty.length ? <EmptyNote>No item responses are stored for these filters.</EmptyNote> : <div className="support-table-scroll" tabIndex={0} aria-label="Question difficulty"><table className="support-table"><thead><tr><th>Question</th><th>Topic</th><th>Asked</th><th>Correct</th><th>Missed</th></tr></thead><tbody>{data.questionDifficulty.map(question => <tr key={`${question.topic}-${question.questionId}`}><th>{question.prompt}</th><td>{question.topic || NOT_RECORDED}</td><td>{question.asked}</td><td>{question.percentCorrect == null ? NOT_RECORDED : showPercent(question.percentCorrect)}</td><td>{question.missed}</td></tr>)}</tbody></table></div>}</Details>
      <Details title={`Frequently missed (${data.frequentlyMissed.length})`} open={data.frequentlyMissed.length > 0}>{!data.frequentlyMissed.length ? <EmptyNote /> : <ul>{data.frequentlyMissed.map(question => <li key={`${question.topic}-${question.questionId}`}>{question.prompt} · {question.topic || NOT_RECORDED} · missed {question.missed} of {question.asked}</li>)}</ul>}</Details>
      <section className="support-panel"><h2>Section comparison</h2>{!sections.length ? <EmptyNote /> : <div className="support-table-scroll" tabIndex={0}><table className="support-table"><thead><tr><th>Section</th><th>Students</th><th>Pre-test completion</th><th>Post-test completion</th><th>Average gain</th></tr></thead><tbody>{sections.map(section => <tr key={section.id}><th>{section.name}</th><td>{section.students}</td><td>{section.pretestCompletion == null ? NOT_RECORDED : showPercent(section.pretestCompletion)}</td><td>{section.posttestCompletion == null ? NOT_RECORDED : showPercent(section.posttestCompletion)}</td><td>{section.averageGain === null ? NOT_RECORDED : showMetric(section.averageGain)}</td></tr>)}</tbody></table></div>}</section>
      <Details title="How gains are paired"><p>{data.gainNote}</p></Details>
    </>}</DeveloperState>
  </div>;
}
