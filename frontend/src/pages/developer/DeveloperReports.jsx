import { useState } from 'react';
import { DeveloperFilters, DeveloperState, ReadOnlyNote, useDeveloperData } from '../../components/developer/DeveloperChrome';
import { apiFetch } from '../../utils/api';

const empty = { grade: '', sectionId: '', topic: '', from: '', to: '' };
export default function DeveloperReports() {
  const [filters, setFilters] = useState(empty);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const state = useDeveloperData('analytics', filters);
  async function download() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const response = await apiFetch(`/api/developer/export?${params.toString()}`);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'The export could not be downloaded.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'levelblue-developer-export.csv'; link.click();
      URL.revokeObjectURL(url);
      setMessage('Export downloaded.');
    } catch (downloadError) { setError(downloadError.message); }
    finally { setBusy(false); }
  }
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Reports</h1><p>Download the assessment and analytics rows you are allowed to view. The file omits passwords, tokens, and email addresses.</p></div><button className="dash-primary-action" disabled={busy || state.loading} onClick={download}>{busy ? 'Preparing…' : 'Download CSV'}</button></header>
    <ReadOnlyNote />
    <DeveloperFilters filters={filters} setFilters={setFilters} sections={state.data?.sections || []} />
    <DeveloperState {...state}>{state.data && <p>{state.data.exportRows} row{state.data.exportRows === 1 ? '' : 's'} match these filters. Item answers that were not stored are marked “Not recorded”.</p>}</DeveloperState>
    {error && <p className="support-error" role="alert">{error}</p>}
    {message && <p className="support-success" role="status">{message}</p>}
  </div>;
}
