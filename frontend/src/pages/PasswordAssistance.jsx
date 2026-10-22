import {RefreshButton} from '../components/WorkspaceUI';
import {SupportPagination,useSupportPage} from '../components/SupportUI';
import '../styles/support.css';
import { useState } from 'react';
import { useWorkspaceData } from '../context/WorkspaceDataContext';
import { apiRequest } from '../utils/api';

const statusText = { pending: 'Needs review', issuing: 'Sending email', approved: 'Waiting for student', delivery_failed: 'Email needs retry', declined: 'Declined', completed: 'Password updated', expired: 'Expired' };
export default function PasswordAssistance() {
  const { data, errors, loading, refresh, refreshing } = useWorkspaceData();
  const pagination=useSupportPage(data.recovery||[],'recovery');
  const [review, setReview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function decide() {
    if (busy || !review) return;
    setBusy(true); setMessage(''); setError('');
    try {
      const response = await apiRequest(`/api/password-assistance/${review.item.id}/decision`, { method: 'POST', signal: AbortSignal.timeout(25000), body: JSON.stringify({ action: review.action }) });
      setMessage(response.message); setReview(null);
    } catch (e) { setError(e.name === 'TimeoutError' ? 'The request timed out. Refresh the queue before retrying.' : e.message); setReview(null); }
    finally { setBusy(false); refresh(); }
  }
  return <div className="dashboard learning-workspace support-workspace">
    <div className="dash-page-intro"><h1>Password Help</h1><p>Review student requests. Approval emails the address already on the account and does not change the password yet.</p></div>
    <section className="learning-card"><h2>Keep students connected</h2><p>Never ask for a student’s password or send them a temporary password. Reset links expire after 15 minutes. Learning progress and mastery stay unchanged.</p><RefreshButton label="Refresh requests" disabled={busy} loading={refreshing} onClick={refresh}/></section>
    {(error || errors.recovery) && <p className="learning-alert" role="alert">{error || errors.recovery}</p>}
    {message && <p className="learning-success" role="status">{message}</p>}
    {review && <section className="learning-card" aria-label="Confirm password assistance"><h2>{review.action === 'approve' ? 'Approve and email a reset link?' : 'Decline this request?'}</h2><p><strong>{review.item.student_name}</strong> · {review.item.section || 'No section assigned'}</p><p>Registered email: <strong>{review.item.email}</strong></p><p>{review.action === 'approve' ? 'Only the student who can access this inbox can complete the reset. Check that you recognize this student before approving.' : 'No email will be sent and the current password will remain unchanged.'}</p><div className="learning-actions"><button className="learning-button" disabled={busy} onClick={decide}>{busy ? 'Processing…' : 'Confirm'}</button><button className="learning-button secondary" disabled={busy} onClick={() => setReview(null)}>Cancel</button></div></section>}
    <section className="learning-card"><h2>Recent requests</h2><p>Up to 200 requests from the last 30 days. Requests expire after 24 hours. The school head can help students without an assigned teacher.</p>
      {loading ? <p role="status">Loading requests…</p> : errors.recovery ? null : !errors.recovery && !(data.recovery || []).length ? <p>No password assistance requests yet.</p> : <div className="learning-table-wrap"><table className="learning-table"><thead><tr><th>Student</th><th>Requested</th><th>Status</th><th>Action</th></tr></thead><tbody>{pagination.items.map(item => <tr key={item.id}><th>{item.student_name}<br/><small>{item.section || 'Unassigned'} · {item.email}</small></th><td>{new Date(item.requested_at).toLocaleString()}</td><td>{statusText[item.status] || item.status}</td><td>{['pending', 'delivery_failed'].includes(item.status) ? <div className="learning-actions"><button className="learning-button" disabled={busy || !!review} onClick={() => setReview({ item, action: 'approve' })}>{item.status === 'delivery_failed' ? 'Retry email' : 'Review approval'}</button><button className="learning-button secondary" disabled={busy || !!review} onClick={() => setReview({ item, action: 'decline' })}>Decline</button></div> : '—'}</td></tr>)}</tbody></table></div>}
      {!loading&&!errors.recovery&&<SupportPagination state={pagination}/>}
    </section>
  </div>;
}
