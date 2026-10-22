import { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/api';
import { NOT_RECORDED } from '../../utils/developerConsole';
import '../../styles/developer.css';

export function useDeveloperData(resource, filters) {
  const [state, setState] = useState({ loading: true, error: '', data: null });
  const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
  useEffect(() => {
    const controller = new AbortController();
    setState(previous => ({ ...previous, loading: true, error: '' }));
    apiRequest(`/api/developer/${resource}${query ? `?${query}` : ''}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setState({ loading: false, error: '', data }); })
      .catch(error => { if (controller.signal.aborted || error?.name === 'AbortError') return; setState({ loading: false, error: error.message || 'This information could not be loaded.', data: null }); });
    return () => controller.abort();
  }, [resource, query]);
  return { ...state, reload: query };
}

export function DeveloperFilters({ filters, setFilters, sections = [] }) {
  const set = (key, value) => setFilters(current => ({ ...current, [key]: value, ...(key === 'grade' ? { sectionId: '' } : {}) }));
  return <div className="support-filters">
    <label>Grade<select value={filters.grade} onChange={event => set('grade', event.target.value)}><option value="">All grades</option><option>Grade 11</option><option>Grade 12</option></select></label>
    <label>Section<select value={filters.sectionId} onChange={event => set('sectionId', event.target.value)}><option value="">All sections</option>{sections.map(section => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
    <label>Topic<select value={filters.topic} onChange={event => set('topic', event.target.value)}><option value="">All topics</option>{['Phishing', 'Smishing', 'Vishing', 'Pretexting', 'Baiting'].map(topic => <option key={topic}>{topic}</option>)}</select></label>
    <label>From<input type="date" value={filters.from} onChange={event => set('from', event.target.value)} /></label>
    <label>To<input type="date" value={filters.to} onChange={event => set('to', event.target.value)} /></label>
  </div>;
}
export function DeveloperState({ loading, error, children }) {
  if (loading) return <p className="support-empty" role="status">Loading recorded data…</p>;
  if (error) return <p className="support-error" role="alert">{error}</p>;
  return children;
}
export function ReadOnlyNote() {
  return <p className="developer-readonly">Read only. Developer access can review records and cannot change students, assessments, or school settings.</p>;
}
export function Metric({ label, value, note }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}
export function EmptyNote({ children }) {
  return <p className="support-empty">{children || 'Nothing is recorded for these filters.'}</p>;
}
export { NOT_RECORDED };
