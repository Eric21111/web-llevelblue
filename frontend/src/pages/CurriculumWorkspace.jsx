import {useEffect,useState} from 'react';
import {BookOpen,Plus,RefreshCw,Send,CheckCircle,History} from 'lucide-react';
import {useAuth} from '../context/AuthContext';
import {apiRequest} from '../utils/api';
import '../styles/curriculum.css';

const TOPICS=['Phishing','Smishing','Vishing','Pretexting','Baiting'];
const KINDS={lesson:'Lesson',quiz:'Practice question',codex:'Threat Codex entry'};
const STATES={draft:'Draft',submitted:'Awaiting review',changes_requested:'Changes requested',approved:'Approved',published:'Published'};
const emptyContent=kind=>kind==='lesson'?{body:'',objectives:[]}:kind==='codex'?{definition:'',warningSigns:[],safeResponse:''}:{prompt:'',options:['','','',''],correctOption:null,explanation:''};
const stamp=value=>value?new Date(value).toLocaleString():'';
function ContentPreview({item}){
 const c=item.content;
 return <article className="curriculum-preview"><span className="curriculum-eyebrow">{KINDS[item.kind]} · {item.topic}</span><h3>{item.title}</h3>
  {item.kind==='lesson'?<><ul>{c.objectives.map((v,i)=><li key={i}>{v}</li>)}</ul><p>{c.body||'No lesson text yet.'}</p></>:item.kind==='codex'?<><p>{c.definition||'No definition yet.'}</p><h4>Warning signs</h4><ul>{c.warningSigns.map((v,i)=><li key={i}>{v}</li>)}</ul><h4>Safe response</h4><p>{c.safeResponse||'No safe response yet.'}</p></>:<><p>{c.prompt||'No question yet.'}</p><ol>{c.options.map((v,i)=><li key={i}>{v||'Empty choice'}{i===c.correctOption&&<strong> — Correct answer</strong>}</li>)}</ol><h4>Answer explanation</h4><p>{c.explanation||'No explanation yet.'}</p></>}
 </article>;
}
export default function CurriculumWorkspace(){
 const {role}=useAuth(),head=role==='super';
 const [items,setItems]=useState([]),[selected,setSelected]=useState(null),[form,setForm]=useState(null);
 const [loadFailed,setLoadFailed]=useState(false);
 const [filter,setFilter]=useState('all'),[topic,setTopic]=useState('all'),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[note,setNote]=useState(''),[history,setHistory]=useState(null),[historyBusy,setHistoryBusy]=useState(false);
 const [publishConfirm,setPublishConfirm]=useState(false);
 const dirty=!!form&&(!selected||JSON.stringify(form)!==JSON.stringify({kind:selected.kind,topic:selected.topic,title:selected.title,content:selected.content}));
 useEffect(()=>{const warn=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 const load=async()=>{setLoading(true);setError('');try{setItems(await apiRequest('/api/curriculum'));setLoadFailed(false);}catch(e){setLoadFailed(true);setError(e.message);}finally{setLoading(false);}};
 useEffect(()=>{load();},[]);
 const choose=item=>{
  if(dirty&&!window.confirm('Discard your unsaved edits?'))return;
  setSelected(item);setForm(item?{kind:item.kind,topic:item.topic,title:item.title,content:structuredClone(item.content)}:null);setNote('');setHistory(null);setPublishConfirm(false);setError('');setNotice('');
 };
 const create=()=>{if(dirty&&!window.confirm('Discard your unsaved edits?'))return;setSelected(null);setForm({kind:'lesson',topic:TOPICS[0],title:'',content:emptyContent('lesson')});setHistory(null);setPublishConfirm(false);setError('');setNotice('');};
 const accept=row=>{setItems(previous=>[row,...previous.filter(r=>r.id!==row.id)]);setSelected(row);setForm({kind:row.kind,topic:row.topic,title:row.title,content:structuredClone(row.content)});setHistory(null);setNote('');setPublishConfirm(false);};
 const save=async e=>{e.preventDefault();setBusy(true);setError('');setNotice('');try{const row=await apiRequest(`/api/curriculum${selected?`/${selected.id}`:''}`,{method:selected?'PATCH':'POST',body:JSON.stringify({...form,version:selected?.version})});accept(row);setNotice('Draft saved. Submit it when it is ready for review.');}catch(e){setError(e.message);}finally{setBusy(false);}};
 const act=async action=>{setBusy(true);setError('');setNotice('');try{accept(await apiRequest(`/api/curriculum/${selected.id}/actions`,{method:'POST',body:JSON.stringify({action,version:selected.version,note})}));setNotice({submit:'Submitted to the school head.',request_changes:'Returned to the teacher with your note.',approve:'Approved. This revision is ready to publish.',publish:'Published to the school content feed. Connected apps can retrieve it on refresh.',revise:'New draft revision created. The previous publication remains available.'}[action]);}catch(e){setError(e.message);}finally{setBusy(false);}};
 const showHistory=async()=>{setHistoryBusy(true);setError('');try{setHistory(await apiRequest(`/api/curriculum/${selected.id}/history`));}catch(e){setError(e.message);}finally{setHistoryBusy(false);}};
 const editable=!head&&form&&(!selected||['draft','changes_requested'].includes(selected.status));
 const visible=items.filter(r=>(filter==='all'||r.status===filter)&&(topic==='all'||r.topic===topic));
 const setContent=(key,value)=>setForm(prev=>({...prev,content:{...prev.content,[key]:value}}));
 const textField=(key,label,max,rows=5)=><label>{label}<textarea rows={rows} maxLength={max} value={form.content[key]} onChange={e=>setContent(key,e.target.value)} /></label>;
 return <div className="learning-workspace curriculum-workspace">
  <header className="curriculum-header"><div><span className="curriculum-eyebrow">Curriculum workspace</span><h1>{head?'Review & publish':'My teaching content'}</h1><p>{head?'Review teacher submissions before making them available to learners.':'Write lessons, practice questions, and threat notes for school-head review.'}</p></div>{!head&&<button className="learning-button" onClick={create} disabled={busy}><Plus size={17}/> New draft</button>}</header>
  <div className="curriculum-summary">{['submitted','changes_requested','approved','published'].map(status=><div key={status}><strong>{loading||loadFailed?'—':items.filter(r=>r.status===status).length}</strong><span>{status==='published'?'Published revisions':STATES[status]}</span></div>)}</div>
  <p className="learning-note">Published school content supplements the mobile learning journey. Campaign stages, mastery, and Codex unlocks stay tied to existing gameplay records.</p>
  {error&&<div className="learning-alert" role="alert">{error} <button onClick={load} disabled={busy||loading}>Reload list</button></div>}
  {notice&&<div className="curriculum-success" role="status">{notice}</div>}
  <div className="curriculum-layout"><section className="learning-card curriculum-list" aria-label="Content library">
   <div className="curriculum-list-heading"><h2>{head?'School content':'Your revisions'}</h2><button aria-label="Refresh content list" className="curriculum-icon" disabled={loading||busy} onClick={load}><RefreshCw size={17}/></button></div>
   <div className="learning-form"><label>Status<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{Object.entries(STATES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Topic<select value={topic} onChange={e=>setTopic(e.target.value)}><option value="all">All topics</option>{TOPICS.map(t=><option key={t}>{t}</option>)}</select></label></div>
   {loading?<p role="status">Loading content…</p>:loadFailed?<p role="status">The content list is unavailable. Use Reload list to try again.</p>:visible.length?visible.map(row=><button key={row.id} className={`curriculum-item ${selected?.id===row.id?'is-selected':''}`} onClick={()=>choose(row)} disabled={busy} aria-pressed={selected?.id===row.id}><span>{KINDS[row.kind]} · {row.topic}</span><strong>{row.title}</strong><span><em className={`curriculum-badge ${row.status}`}>{STATES[row.status]}</em> Revision {row.revision}</span><small>{head?`${row.author_name || "Teacher"} · `:""}Updated {stamp(row.updated_at)}</small></button>):<p className="learning-note">{items.length?'No content matches these filters.':head?'Teacher submissions will appear here.':'Create your first draft to share a learning resource.'}</p>}
  </section><section className="learning-card curriculum-editor" aria-label="Selected content">
   {!form?<div className="curriculum-placeholder"><BookOpen size={34}/><h2>{head?'Choose a submission':'Make knowledge useful'}</h2><p>{head?'Open a revision to review its content and history.':'Select an existing revision or start a new draft.'}</p></div>:<>
    <div className="curriculum-list-heading"><h2>{editable?selected?'Edit draft':'New draft':'Content preview'}</h2>{selected&&<span className={`curriculum-badge ${selected.status}`}>{STATES[selected.status]} · v{selected.revision}</span>}</div>
    {selected?.review_note&&<aside className="curriculum-review"><strong>School-head review</strong><p>{selected.review_note}</p></aside>}
    {editable?<form className="learning-form" onSubmit={save}><fieldset disabled={busy}>
     {!selected&&<div className="curriculum-fields"><label>Content type<select value={form.kind} onChange={e=>setForm({...form,kind:e.target.value,content:emptyContent(e.target.value)})}>{Object.entries(KINDS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Topic<select value={form.topic} onChange={e=>setForm({...form,topic:e.target.value})}>{TOPICS.map(t=><option key={t}>{t}</option>)}</select></label></div>}
     <label>Title<input required maxLength={180} value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
     {form.kind==='lesson'?<>{textField('body','Lesson text',20000,10)}<label>Learning objectives (one per line)<textarea rows={3} value={form.content.objectives.join('\n')} onChange={e=>setContent('objectives',e.target.value.split('\n'))}/></label></>:form.kind==='codex'?<>{textField('definition','Threat definition',10000)}<label>Warning signs (one per line)<textarea rows={3} value={form.content.warningSigns.join('\n')} onChange={e=>setContent('warningSigns',e.target.value.split('\n'))}/></label>{textField('safeResponse','Safe response',10000)}</>:<>{textField('prompt','Question',5000,3)}{form.content.options.map((option,i)=><label key={i}>Answer choice {i+1}<input maxLength={1000} value={option} onChange={e=>setContent('options',form.content.options.map((v,j)=>j===i?e.target.value:v))}/></label>)}<label>Correct answer<select value={form.content.correctOption??''} onChange={e=>setContent('correctOption',e.target.value===''?null:Number(e.target.value))}><option value="">Choose an answer</option>{form.content.options.map((_,i)=><option key={i} value={i}>Answer choice {i+1}</option>)}</select></label>{textField('explanation','Answer explanation',10000,3)}</>}
     <button className="learning-button" type="submit" disabled={!dirty}>{busy?'Saving…':'Save draft'}</button>{dirty&&<span className="learning-note"> Unsaved changes</span>}
    </fieldset></form>:<ContentPreview item={form}/>}
    {selected&&<div className="curriculum-actions">
     {editable&&<><p className="learning-note">Save your edits before submitting. Submitted revisions are locked until the school head requests changes.</p><button className="learning-button" disabled={busy||dirty} onClick={()=>act('submit')}><Send size={16}/> Submit for review</button></>}
     {head&&selected.status==='submitted'&&<><label className="learning-form">Review note<textarea maxLength={3000} rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Explain any changes the teacher should make."/></label><div className="curriculum-action-row"><button className="learning-button" disabled={busy} onClick={()=>act('approve')}><CheckCircle size={16}/> Approve revision</button><button className="curriculum-secondary" disabled={busy||!note.trim()} onClick={()=>act('request_changes')}>Request changes</button></div></>}
     {head&&selected.status==='approved'&&(publishConfirm?<div className="curriculum-review"><strong>Publish revision {selected.revision}?</strong><p>This makes “{selected.title}” available to students through the school content feed.</p><div className="curriculum-action-row"><button className="learning-button" disabled={busy} onClick={()=>act('publish')}>Confirm publication</button><button className="curriculum-secondary" disabled={busy} onClick={()=>setPublishConfirm(false)}>Cancel</button></div></div>:<button className="learning-button" disabled={busy} onClick={()=>setPublishConfirm(true)}>Publish approved revision</button>)}
     {!head&&selected.status==='published'&&!items.some(r=>r.item_id===selected.item_id&&(r.revision>selected.revision||r.status!=='published'))&&<button className="learning-button" disabled={busy} onClick={()=>act('revise')}>Create new revision</button>}
     {selected.status==='published'&&<p className="learning-note">Published {stamp(selected.published_at)} · Release {selected.release_version}. Published revisions are immutable.</p>}
     <button className="curriculum-secondary" disabled={busy||historyBusy} onClick={showHistory}><History size={16}/> {historyBusy?'Loading history…':'View revision history'}</button>
     {history&&<ol className="curriculum-history">{history.map(event=><li key={event.id}><strong>{event.action.replaceAll('_',' ')}</strong><span>{event.actor_name || "Staff member"} · {stamp(event.created_at)}</span>{event.note&&<p>{event.note}</p>}</li>)}</ol>}
    </div>}
   </>}
  </section></div>
 </div>;
}
