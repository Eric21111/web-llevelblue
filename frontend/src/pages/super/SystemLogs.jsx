import {useWorkspaceQuery} from '../../hooks/useWorkspaceQuery';
import Skeleton from '../../components/Skeleton';
import {useState} from 'react';
import {SupportPagination,useSupportPage} from '../../components/SupportUI';
import '../../styles/support.css';
export default function SystemLogs(){
 const [query,setQuery]=useState('');
 const {data:{logs=[]},errors:{logs:error},loading}=useWorkspaceQuery({logs:'/api/system-logs'});
 const filtered=logs.filter(l=>`${l.user} ${l.action} ${l.details}`.toLowerCase().includes(query.trim().toLowerCase())),page=useSupportPage(filtered,query);
 return <div className="dashboard support-workspace"><header className="support-page-heading"><div><h1>Activity Log</h1><p>The latest 100 account and content changes.</p></div></header><section className="support-panel"><div className="support-filters"><label>Search activity<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Person, action, or details…"/></label></div>{error?<p role="alert" className="support-error">{error}</p>:loading?<Skeleton label="Loading activity"/>:<>{!filtered.length?<p className="support-empty">No recorded activity matches this view.</p>:<div className="support-table-scroll" tabIndex={0} aria-label="Activity records"><table className="support-table"><thead><tr><th>Action</th><th>Person & details</th><th>Recorded</th></tr></thead><tbody>{page.items.map((l,i)=><tr key={l._id||l.id||i}><th>{l.action||'Recorded action'}</th><td><strong>{l.user||'System'}</strong><p>{l.details}</p></td><td>{new Date(l.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}<SupportPagination state={page}/></>}</section></div>;
}
