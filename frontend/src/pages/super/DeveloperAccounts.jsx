import { useState } from 'react';
import { Plus } from 'lucide-react';
import { apiRequest } from '../../utils/api';
import { ContactFields, CredentialsDialog, DirectoryState, ManagementDialog, contactForm, useDirectory } from '../../components/ManagementUI';
import TeacherPasswordPreview from '../../components/TeacherPasswordPreview';
import { WorkspaceButton } from '../../components/WorkspaceUI';

const sources = { developers: '/api/developers' };

export default function DeveloperAccounts() {
  const state = useDirectory(sources);
  const developers = state.data.developers || [];
  const [form, setForm] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [passwordPreview, setPasswordPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function save(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await apiRequest('/api/developers', { method: 'POST', body: JSON.stringify(form) });
      setMessage('Developer account created.');
      if (result.generatedPassword) setCredentials(result);
      setForm(null); state.refresh();
    } catch (saveError) { setError(saveError.message); }
    finally { setBusy(false); }
  }
  async function setStatus(developer, status) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await apiRequest(`/api/developers/${encodeURIComponent(developer._id)}`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessage(status === 'Inactive' ? 'Developer deactivated.' : 'Developer access restored.');
      state.refresh();
    } catch (statusError) { setError(statusError.message); }
    finally { setBusy(false); }
  }
  return <div className="dashboard support-workspace">
    <header className="support-page-heading"><div><h1>Developer accounts</h1><p>Only a school head can invite or deactivate developer access. Developers can review learning records and cannot manage the school.</p></div><WorkspaceButton variant="primary" disabled={busy} onClick={() => { setError(''); setForm(contactForm()); }}><Plus size={16} />Invite developer</WorkspaceButton></header>
    {message && <p className="support-success" role="status">{message}</p>}
    {error && !form && <p className="support-error" role="alert">{error}</p>}
    <section className="support-panel"><DirectoryState {...state}>{!developers.length ? <p className="support-empty">No developer accounts yet.</p> : <div className="support-table-scroll" tabIndex={0} aria-label="Developer accounts"><table className="support-table"><thead><tr><th>Developer</th><th>Status</th><th>Actions</th></tr></thead><tbody>{developers.map(developer => <tr key={developer._id}><th>{developer.name}<small>{developer.email}</small></th><td>{developer.status}</td><td><div className="management-actions">{developer.status === 'Invited' && <WorkspaceButton onClick={() => setPasswordPreview(developer)}>Temporary password</WorkspaceButton>}<WorkspaceButton disabled={busy} onClick={() => setStatus(developer, developer.status === 'Inactive' ? 'Active' : 'Inactive')}>{developer.status === 'Inactive' ? 'Reactivate' : 'Deactivate'}</WorkspaceButton></div></td></tr>)}</tbody></table></div>}</DirectoryState></section>
    {form && <ManagementDialog title="Invite developer" busy={busy} onClose={() => setForm(null)}><form className="support-form" onSubmit={save}><fieldset disabled={busy} className="support-form"><ContactFields form={form} setForm={setForm} /><p>A temporary password is generated. The developer verifies an email code and chooses a password before opening the developer workspace.</p>{error && <p className="support-error" role="alert">{error}</p>}<footer className="support-dialog-actions"><WorkspaceButton type="button" onClick={() => setForm(null)}>Cancel</WorkspaceButton><WorkspaceButton type="submit" variant="primary">{busy ? 'Saving…' : 'Invite developer'}</WorkspaceButton></footer></fieldset></form></ManagementDialog>}
    {credentials && <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />}
    {passwordPreview && <TeacherPasswordPreview teacher={passwordPreview} audience="developer" endpoint={`/api/developers/${encodeURIComponent(passwordPreview._id)}/temporary-password`} onClose={() => setPasswordPreview(null)} />}
  </div>;
}
