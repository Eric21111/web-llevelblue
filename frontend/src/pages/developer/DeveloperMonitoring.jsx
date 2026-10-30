import { useState } from 'react';
import { DeveloperFilters, DeveloperState, EmptyNote, ReadOnlyNote, useDeveloperData } from '../../components/developer/DeveloperChrome';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
function EventList({ title, rows, empty }) {
  return <details className="lb-details" open={rows.length > 0 || undefined}><summary>{title} ({rows.length})</summary><div>{!rows.length ? <EmptyNote>{empty}</EmptyNote> : <ul>{rows.map(row => <li key={row.id || `${row.studentId}-${row.kind}-${row.occurredAt}`}>{row.message || `${row.name || 'Record'} · ${row.kind || row.category} · ${row.topic || row.route || 'Not recorded'} · ${row.occurredAt || row.answers || ''}`}</li>)}</ul>}</div></details>;
}
export default function DeveloperMonitoring() {
  const [filters, setFilters] = useState(empty);
  const state = useDeveloperData('monitoring', filters);
  const data = state.data;
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Data monitoring</h1><p>Gaps and logged failures from stored records.</p></div></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={data?.sections || []} />
    <DeveloperState {...state}>{data && <>
      <p>{data.note}</p>
      {!data.available && <p className="support-error" role="alert">Operational logs are not available yet.</p>}
      {!data.learningAvailable && <p className="support-error" role="alert">Learning records are not available yet.</p>}
      <EventList title="Incomplete assessments" rows={data.incompleteAssessments} empty="No incomplete assessment events for these filters." />
      <EventList title="Completed assessments without item answers" rows={data.missingAnswers} empty="No completed assessment is missing stored answers." />
      <EventList title="Invalid events" rows={data.invalidEvents} empty="No invalid events are logged." />
      <EventList title="Duplicate events" rows={data.duplicateEvents} empty="No duplicate events are logged." />
      <EventList title="Failed synchronization" rows={data.syncFailures} empty="No synchronization failures are logged." />
      <EventList title="System and API errors" rows={data.apiErrors} empty="No sanitized API errors are logged." />
    </>}</DeveloperState>
  </div>;
}
