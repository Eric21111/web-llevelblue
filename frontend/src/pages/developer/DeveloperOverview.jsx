import { useState } from 'react';
import { Details, DeveloperFilters, DeveloperState, EmptyNote, Metric, ReadOnlyNote, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { NOT_RECORDED, showMetric } from '../../utils/developerConsole';
import Term from '../../components/Term';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
export default function DeveloperOverview() {
  const [filters, setFilters] = useState(empty);
  const state = useDeveloperData('overview', filters);
  const overview = state.data?.overview;
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Overview</h1><p>Stored counts and averages for the current filters.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={state.data?.sections || []} />
    <DeveloperState {...state}>{overview && <>
      <section className="support-summary" aria-label="Recorded overview">
        <Metric label="Students" value={showMetric(overview.totalStudents, 0)} />
        <Metric label="Completed pre-tests" value={showMetric(overview.completedPretests, 0)} />
        <Metric label="Completed post-tests" value={showMetric(overview.completedPosttests, 0)} />
        <Metric label="Average pre-test" value={overview.averagePretest === null ? NOT_RECORDED : `${showMetric(overview.averagePretest)}%`} />
        <Metric label="Average post-test" value={overview.averagePosttest === null ? NOT_RECORDED : `${showMetric(overview.averagePosttest)}%`} />
        <Metric label={<Term name="learning-gain">Learning gain</Term>} value={overview.averageGain === null ? NOT_RECORDED : `${showMetric(overview.averageGain)} pts`} note={`${overview.comparablePairs} comparable pair${overview.comparablePairs === 1 ? '' : 's'}`} />
        <Metric label="Active learners" value={showMetric(overview.activeLearners, 0)} note={overview.activeDefinition} />
      </section>
      {!overview.totalStudents && <EmptyNote />}
      <Details title="How these numbers are calculated"><ul>{overview.limitations.map(item => <li key={item}>{item}</li>)}</ul></Details>
    </>}</DeveloperState>
  </div>;
}
