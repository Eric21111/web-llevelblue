import WorkspaceSelect from '../WorkspaceSelect';
import {useWorkspaceQuery} from '../../hooks/useWorkspaceQuery';
import Skeleton from '../Skeleton';
import { NOT_RECORDED } from '../../utils/developerConsole';
import '../../styles/developer.css';

export function useDeveloperData(resource, filters) {
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  const {data,errors,loading}=useWorkspaceQuery({result:`/api/developer/${resource}${query?'?'+query:''}`});
  return {data:data.result,error:errors.result,loading,reload:query};
}

export function DeveloperFilters({ filters, setFilters, sections = [] }) {
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value, ...(key === 'grade' ? { sectionId: '' } : {}) }));
  return <div className="support-filters">
    <label>Grade<WorkspaceSelect value={filters.grade} onChange={event => set('grade', event.target.value)}><option value="">All grades</option><option>Grade 11</option><option>Grade 12</option></WorkspaceSelect></label>
    <label>Section<WorkspaceSelect value={filters.sectionId} onChange={event => set('sectionId', event.target.value)}><option value="">All sections</option>{sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</WorkspaceSelect></label>
    <label>Topic<WorkspaceSelect value={filters.topic} onChange={event => set('topic', event.target.value)}><option value="">All topics</option>{['Phishing', 'Smishing', 'Vishing', 'Pretexting', 'Baiting'].map(topic => <option key={topic}>{topic}</option>)}</WorkspaceSelect></label>
    <label>From<input type="date" value={filters.from} onChange={event => set('from', event.target.value)} /></label>
    <label>To<input type="date" value={filters.to} onChange={event => set('to', event.target.value)} /></label>
  </div>;
}
export function DeveloperState({ loading, error, children }) {
  if (loading) return <Skeleton label="Loading recorded data"/>;
  if (error) return <p className="support-error" role="alert">{error}</p>;
  return children;
}
export function Metric({ label, value, note }) {
  return <article><span>{label}</span><strong>{value}</strong>{note ? <small>{note}</small> : null}</article>;
}
export function Details({ title, children, open = false }) {
  return <details className="lb-details" open={open || undefined}><summary>{title}</summary><div>{children}</div></details>;
}
export function recorded(value, suffix = '') {
  return value == null || Number.isNaN(value) ? NOT_RECORDED : `${value}${suffix}`;
}
export function EmptyNote({ children }) {
  return <p className="support-empty">{children || 'Nothing is recorded for these filters.'}</p>;
}
export { NOT_RECORDED };
