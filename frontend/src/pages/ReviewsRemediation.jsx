import {useEffect,useRef,useState} from 'react';
import {Plus,RefreshCw,ClipboardCheck,CalendarDays,Users} from 'lucide-react';
import useSupportData from '../hooks/useSupportData';
import {SupportDialog,SupportFilters,SupportPagination,useSupportPage} from '../components/SupportUI';
import {SKILLS,studentId} from '../utils/dashboard';
import {ACTION_LABELS,OUTCOMES,filterSupportActions,recordedTopics,supportTopics} from '../utils/support';
import {apiRequest} from '../utils/api';
import '../styles/support.css';

const actionChoices=[['review',ClipboardCheck,'Learning review','Document what you checked and the next step.'],['remediation',CalendarDays,'Classroom support','Schedule a teaching session and track the result.'],['bounty-review',Users,'Mentor review','Record your review of an existing mentor assignment.']];
const emptyForm={studentId:'',kind:'review',topic:'Phishing',note:'',scheduledDate:'',outcome:'Completed',bountyId:''};

export default function ReviewsRemediation({onNavigate}){
 const {data,errors,loading,refresh}=useSupportData();
 const [section,setSection]=useState(''),[grade,setGrade]=useState(''),[query,setQuery]=useState(''),[status,setStatus]=useState('');
 const [form,setForm]=useState(null),[editing,setEditing]=useState(null),[nextOutcome,setNextOutcome]=useState(''),[busy,setBusy]=useState(false),[saveError,setSaveError]=useState(''),[message,setMessage]=useState(''),[linkError,setLinkError]=useState('');
 const [bounties,setBounties]=useState([]),[bountyLoading,setBountyLoading]=useState(false),[bountyError,setBountyError]=useState(''),[bountyRevision,setBountyRevision]=useState(0);
 const openedLink=useRef(false);
 function openForm(student,topic){setSaveError('');setForm({...emptyForm,studentId:student?studentId(student):'',topic:SKILLS.includes(topic)?topic:student?supportTopics(student)[0]||'Phishing':'Phishing'});}
 useEffect(()=>{
  if(loading||errors.students||openedLink.current)return;
  openedLink.current=true;const params=new URLSearchParams(window.location.search),id=params.get('studentId');
  if(!id)return;const selected=data.students.find(s=>studentId(s)===id);
  if(selected)openForm(selected,params.get('topic'));else setLinkError('That student is no longer available in your assigned sections. Choose another student to continue.');
 },[loading,errors.students,data.students]);
 useEffect(()=>{
  if(form?.kind!=='bounty-review')return;
  const controller=new AbortController();setBountyLoading(true);setBountyError('');setBounties([]);
  apiRequest('/api/bounties',{signal:controller.signal}).then(setBounties).catch(e=>{if(!controller.signal.aborted)setBountyError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBountyLoading(false);});return()=>controller.abort();
 },[form?.kind,bountyRevision]);
 const scopedNotes=filterSupportActions(data.notes,data.students,data.sections,{section,grade,query});
 const notes=scopedNotes.filter(n=>!status||n.outcome===status).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const pagination=useSupportPage(notes,`${section}|${grade}|${query}|${status}`);
 const selected=data.students.find(s=>studentId(s)===form?.studentId);
 const selectedBounties=bounties.filter(b=>String(b.mentee_id)===form?.studentId);
 const setField=(key,value)=>setForm(previous=>({...previous,[key]:value}));
 async function save(event){event.preventDefault();if(busy)return;setBusy(true);setSaveError('');try{
  await apiRequest('/api/interventions',{method:'POST',body:JSON.stringify(form)});
  setMessage(`${ACTION_LABELS[form.kind]} saved for ${selected.name}.`);setForm(null);refresh();
 }catch(e){setSaveError(e.message);}finally{setBusy(false);}}
 async function saveOutcome(event){event.preventDefault();if(busy)return;setBusy(true);setSaveError('');try{
  await apiRequest(`/api/interventions/${encodeURIComponent(editing.id)}`,{method:'PATCH',body:JSON.stringify({outcome:nextOutcome})});
  setMessage('Action outcome updated.');setEditing(null);refresh();
 }catch(e){setSaveError(e.message);}finally{setBusy(false);}}
 return <div className="dashboard support-workspace">
  <header className="support-page-heading"><div><h1>Reviews & remediation</h1><p>Keep a record of the support you provide, then return to update what happened.</p></div><button className="dash-primary-action" disabled={loading||!!errors.students||!data.students.length} onClick={()=>openForm()}><Plus size={16}/>Record support</button></header>
  <div className="support-guide"><strong>How this works</strong><span>Review a learner → record your action → update its outcome after the session. Completing an action does not change mastery or confirm mentoring.</span></div>
  {message&&<p className="support-success" role="status">{message}</p>}{linkError&&<p className="support-error" role="alert">{linkError}</p>}
  <section className="support-panel"><SupportFilters sections={data.sections} grade={grade} setGrade={setGrade} section={section} setSection={setSection} query={query} setQuery={setQuery}/>
   <div className="support-summary support-summary-static">{[['Open actions',scopedNotes.filter(n=>n.outcome!=='Completed').length,'Pending, in progress, or needing follow-up'],['Completed actions',scopedNotes.filter(n=>n.outcome==='Completed').length,'Teacher-recorded outcomes'],['Classroom support plans',scopedNotes.filter(n=>n.kind==='remediation').length,'Scheduled teaching sessions']].map(([label,value,detail])=><article key={label}><span>{label}</span><strong>{loading||errors.notes||errors.students?'—':value}</strong><small>{detail}</small></article>)}</div>
  </section>
  <section className="support-panel"><div className="support-section-heading"><div><h2>Support history</h2><p>Most recently recorded first. Open an action to read its note and update the outcome.</p></div><button className="dash-button" disabled={loading} onClick={refresh}><RefreshCw size={15}/>Refresh</button></div>
   <label className="support-topic-filter">Outcome<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All outcomes</option>{OUTCOMES.map(o=><option key={o}>{o}</option>)}</select></label>
   {Object.keys(errors).length>0&&<p role="alert" className="support-error">{errors.notes||errors.students||errors.sections} Use Refresh to try again.</p>}
   {loading?<p className="support-empty" role="status">Loading support history…</p>:errors.notes||errors.students?null:!notes.length?<div className="support-empty"><ClipboardCheck size={28}/><h3>No actions in this view</h3><p>{status||query||section||grade?'Try different filters, or record a new action.':'Start by reviewing a student from Student Follow-ups, or choose Record support above.'}</p><button className="dash-button" onClick={()=>onNavigate('/follow-ups')}>Find students needing support</button></div>:<div className="support-table-scroll" tabIndex={0} aria-label="Scrollable support history"><table className="support-table"><thead><tr><th>Student / topic</th><th>Action</th><th>Schedule</th><th>Outcome</th><th>Details</th></tr></thead><tbody>{pagination.items.map(n=>{const s=data.students.find(s=>studentId(s)===String(n.student_id));return <tr key={n.id}><th>{s?.name||'Former / unavailable learner'}<small>{n.topic} · {data.sections.find(s=>s.id===n.section_id)?.name||'Previous section'}</small></th><td>{ACTION_LABELS[n.kind]||n.kind}<small>Recorded {new Date(n.created_at).toLocaleDateString()}</small></td><td>{n.scheduled_date||'Not scheduled'}</td><td><span className={`support-status ${n.outcome==='Completed'?'is-complete':''}`}>{n.outcome}</span></td><td><button className="dash-button" aria-label={`View action for ${s?.name||'learner'}: ${n.topic}`} onClick={()=>{setSaveError('');setEditing(n);setNextOutcome(n.outcome);}}>View action</button></td></tr>;})}</tbody></table></div>}
   {!loading&&!errors.notes&&!errors.students&&<SupportPagination state={pagination}/>}
  </section>
  {form&&<SupportDialog title="Record student support" busy={busy} onClose={()=>setForm(null)}><form onSubmit={save}><fieldset disabled={busy} className="support-form">
   <label>1. Choose a student<select required value={form.studentId} onChange={e=>{const s=data.students.find(s=>studentId(s)===e.target.value);setForm({...emptyForm,studentId:e.target.value,topic:s?supportTopics(s)[0]||'Phishing':'Phishing'});setSaveError('');}}><option value="">Select a learner</option>{data.students.map(s=><option key={studentId(s)} value={studentId(s)}>{s.name} · {s.section}</option>)}</select></label>
   {selected&&<aside className="support-context"><strong>{selected.section} · {selected.gradeLevel||'Grade unconfirmed'}</strong><p>Recorded topic mastery</p><div className="support-tags">{SKILLS.map(t=><span key={t} className={supportTopics(selected).includes(t)?'needs-support':'neutral'}>{t}: {recordedTopics(selected).includes(t)?`${Math.round(selected.mastery[t]*100)}%`:'Unassessed'}</span>)}</div><small>Below 40% suggests a learning need. Missing mastery is not a failed assessment.</small></aside>}
   <fieldset className="support-action-choices"><legend>2. What support are you recording?</legend>{actionChoices.map(([key,Icon,label,description])=><label key={key} className={form.kind===key?'is-selected':''}><input type="radio" name="support-kind" value={key} checked={form.kind===key} onChange={()=>setForm(v=>({...v,kind:key,bountyId:'',outcome:key==='review'?'Completed':'Pending'}))}/><Icon size={18}/><span><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>
   <div className="support-form-columns"><label>Topic<select value={form.topic} onChange={e=>setField('topic',e.target.value)}>{SKILLS.map(t=><option key={t}>{t}</option>)}</select></label>{form.kind==='remediation'&&<label>Session date<input required type="date" value={form.scheduledDate} onInput={e=>setField('scheduledDate',e.currentTarget.value)}/></label>}</div>
   {form.kind==='bounty-review'&&<div className="support-context"><p>This records your review only. The student’s confirmation and mentor rewards remain unchanged.</p>{bountyLoading?<p role="status">Loading mentor assignments…</p>:bountyError?<p role="alert">{bountyError} <button type="button" className="dash-button" onClick={()=>setBountyRevision(v=>v+1)}>Retry</button></p>:!selectedBounties.length?<p>No mentor assignment recorded for this student. Assign a mentor from the student roster first, or choose another action.</p>:<label>Mentor assignment<select required value={form.bountyId} onChange={e=>{const bounty=selectedBounties.find(b=>String(b.id)===e.target.value);setForm(v=>({...v,bountyId:e.target.value,topic:SKILLS.includes(bounty?.topic)?bounty.topic:v.topic}));}}><option value="">Choose an assignment</option>{selectedBounties.map(b=><option key={b.id} value={b.id}>{b.topic} · {b.status}{b.cancelled_at?' · Cancelled':''}</option>)}</select></label>}</div>}
   <label>3. Note and next step<textarea required maxLength={5000} rows={4} value={form.note} onChange={e=>setField('note',e.target.value)} placeholder={form.kind==='remediation'?'What will you teach or practice, and how will you check understanding?':'What did you review, what did you notice, and what happens next?'}/></label>
   <label>Current outcome<select value={form.outcome} onChange={e=>setField('outcome',e.target.value)}>{OUTCOMES.map(o=><option key={o}>{o}</option>)}</select></label>
   {saveError&&<p className="support-error" role="alert">{saveError}</p>}
   <footer className="support-dialog-actions"><button type="button" className="dash-button" onClick={()=>setForm(null)}>Cancel</button><button className="dash-primary-action" disabled={!selected||!form.note.trim()||(form.kind==='bounty-review'&&(!form.bountyId||bountyLoading||!!bountyError))}>{busy?'Saving…':'Save action'}</button></footer>
  </fieldset></form></SupportDialog>}
  {editing&&<SupportDialog title={ACTION_LABELS[editing.kind]||'Recorded action'} busy={busy} onClose={()=>setEditing(null)}><div className="support-context"><strong>{data.students.find(s=>studentId(s)===String(editing.student_id))?.name||'Former / unavailable learner'} · {editing.topic}</strong><p>Recorded {new Date(editing.created_at).toLocaleString()}{editing.scheduled_date&&` · Session: ${editing.scheduled_date}`}</p><p className="support-note">{editing.note}</p>{editing.kind==='bounty-review'&&<small>Teacher review only. This does not confirm that mentoring occurred.</small>}</div><form className="support-form" onSubmit={saveOutcome}><label>Outcome<select disabled={busy} value={nextOutcome} onChange={e=>setNextOutcome(e.target.value)}>{OUTCOMES.map(o=><option key={o}>{o}</option>)}</select></label><p>Use “Completed” once this action is finished. It does not change the student’s mastery.</p>{saveError&&<p role="alert" className="support-error">{saveError}</p>}<footer className="support-dialog-actions"><button type="button" className="dash-button" disabled={busy} onClick={()=>setEditing(null)}>Close</button><button className="dash-primary-action" disabled={busy||nextOutcome===editing.outcome}>{busy?'Saving…':'Save outcome'}</button></footer></form></SupportDialog>}
 </div>;
}
