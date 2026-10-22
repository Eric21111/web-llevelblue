import { useState } from 'react';
import { DeveloperFilters, DeveloperState, EmptyNote, Metric, ReadOnlyNote, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { showMetric } from '../../utils/developerConsole';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
export default function DeveloperOverview() {
  const [filters, setFilters] = useState(empty);
  const state = useDeveloperData('overview', filters);
  const overview = state.data?.overview;
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Developer overview</h1><p>Counts and averages come from stored student, assessment, and activity records.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={state.data?.sections || []} />
    <DeveloperState {...state}>{overview && <>
      <section className="support-summary" aria-label="Recorded overview">
        <Metric label="Students" value={showMetric(overview.totalStudents, 0)} note="In the selected grade and section" />
        <Metric label="Completed pre-tests" value={showMetric(overview.completedPretests, 0)} note="Students with a completed pre-test" />
        <Metric label="Completed post-tests" value={showMetric(overview.completedPosttests, 0)} note="Students with a completed post-test" />
        <Metric label="Average pre-test" value={overview.averagePretest === null ? '—' : `${showMetric(overview.averagePretest)}%`} note="Recorded scores only" />
        <Metric label="Average post-test" value={overview.averagePosttest === null ? '—' : `${showMetric(overview.averagePosttest)}%`} note="Recorded scores only" />
        <Metric label="Learning gain" value={overview.averageGain === null ? '—' : `${showMetric(overview.averageGain)} pts`} note={`${overview.comparablePairs} comparable pair${overview.comparablePairs === 1 ? '' : 's'}`} />
        <Metric label="Active learners" value={showMetric(overview.activeLearners, 0)} note={overview.activeDefinition} />
      </section>
      {!overview.totalStudents && <EmptyNote />}
      <ul className="developer-threshold">{overview.limitations.map(item => <li key={item}>{item}</li>)}</ul>
    </>}</DeveloperState>
  </div>;
}
