import WorkspaceSelect from '../components/WorkspaceSelect';
import Skeleton from '../components/Skeleton';
import {useWorkspaceQuery} from '../hooks/useWorkspaceQuery';
import {ViewChoices,WorkspaceButton} from '../components/WorkspaceUI';
import StudentMastery from '../components/StudentMastery';
import LearningEvidence from '../components/LearningEvidence';
import Term from '../components/Term';
import {useEffect,useState} from 'react';
import {Download,CheckCircle,ClipboardList,ChartColumnIncreasing,FileText,FileSpreadsheet} from 'lucide-react';
import {apiRequest,apiFetch} from '../utils/api';
import {SKILLS as TOPICS} from '../utils/dashboard';
const pct=v=>v===null||v===undefined?'Not recorded':`${Math.round(v*100)}%`;
export default function LearningWorkspace({user,mode='diagnostics'}) {
 const head=user?.role==='super';
 const [view,setView]=useState(mode==='reports'?'export':'topics');
 useEffect(()=>setView(mode==='reports'?'export':'topics'),[mode]);
 const views=mode==='reports'?[{id:'export',title:'Export reports',description:'PDF & CSV downloads'}]:[{id:'topics',title:'Topic overview',description:'Coverage & support needs'},...(head?[{id:'comparisons',title:'Compare cohorts',description:'Grades & sections'}]:[]),{id:'heatmap',title:'Student mastery',description:'Learner-by-topic heatmap'}];
 views.push({id:'assessments',title:'Assessments',description:'Scores, answers & learning gains'},{id:'stages',title:'Stage attempts',description:'Results & attempt evidence'},{id:'trends',title:'Mastery history',description:'Dated observations'});
 const [enrollment,setEnrollment]=useState('active');
 const [section,setSection]=useState(''),[grade,setGrade]=useState('');
 const [actionError,setError]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [studentId,setStudentId]=useState(''),[kind,setKind]=useState('review'),[topic,setTopic]=useState(TOPICS[0]),[note,setNote]=useState(''),[date,setDate]=useState(''),[outcome,setOutcome]=useState('Pending'),[bountyId,setBountyId]=useState('');
 const filters=new URLSearchParams({enrollment,...section&&{sectionId:section},...grade&&{grade}}).toString();
 const {data:{sections=[],analytics:data,notes=[],bounties=[]},errors,loading,refresh}=useWorkspaceQuery({
   sections:'/api/sections',analytics:`/api/analytics?${filters}`,notes:`/api/interventions?${filters}`,...mode==='interventions'&&{bounties:'/api/bounties'}
 });
 const error=actionError||Object.values(errors)[0];
 useEffect(()=>{setStudentId('');setError('');},[filters,mode]);
 const students=data?.students||[];
 async function save(e) {e.preventDefault();setBusy(true);setError('');setMessage('');try{
   await apiRequest('/api/interventions',{method:'POST',body:JSON.stringify({studentId,kind,topic,note,scheduledDate:date,outcome,bountyId})});
   setNote('');setMessage('Action recorded. Student-confirmed mentoring outcomes are unchanged.');refresh();
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 async function update(id,value) {setBusy(true);setError('');try{await apiRequest(`/api/interventions/${id}`,{method:'PATCH',body:JSON.stringify({outcome:value})});refresh();setMessage('Outcome updated.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function download(format) {setBusy(true);setError('');try{
   const query=new URLSearchParams({enrollment,...section&&{sectionId:section},...grade&&{grade},...studentId&&{studentId},format});
   const response=await apiFetch(`/api/reports/${studentId?'individual':'institutional'}?${query}`);
   if(!response.ok)throw new Error((await response.json()).error||'Export failed.');
   const url=URL.createObjectURL(await response.blob());const a=document.createElement('a');a.href=url;a.download=`LEVELBLUE-learning-report.${format}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Report downloaded.');
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 const reporting = mode==='reports';
 const title = reporting ? (head?'Institutional Reports':'Learning Reports') : mode==='interventions'?'Reviews':head?'School Progress':'Diagnostics';
 const HeroIcon = reporting ? FileText : ChartColumnIncreasing;
 return <div className={'dashboard learning-workspace workspace-insights '+(reporting?'reports-view':'progress-view')}>
  <header className="insight-header"><span className="insight-symbol"><HeroIcon aria-hidden="true"/></span><div><h1>{title}</h1><p>{reporting?'Prepare a report for your school, a section, or an individual learner.':mode==='interventions'?'Record a classroom review or remediation.':'Compare recorded mastery and find the topics where learners need support.'}</p></div></header>
  <div className="workspace-filter-panel"><div className="learning-filters"><label>Grade<WorkspaceSelect value={grade} onChange={e=>{setGrade(e.target.value);setSection('');}}><option value="">All grades</option><option>Grade 11</option><option>Grade 12</option></WorkspaceSelect></label><label>Section<WorkspaceSelect value={section} onChange={e=>setSection(e.target.value)}><option value="">{head?'All school sections':'All assigned sections'}</option>{sections.filter(s=>!grade||s.gradeLevel===grade).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</WorkspaceSelect></label></div>
  {mode==='reports'&&<label className="learning-evidence-filter">Enlistment<WorkspaceSelect value={enrollment} onChange={e=>setEnrollment(e.target.value)}><option value="active">Active learners</option><option value="graduated">Graduated / archived</option><option value="all">All authorized learners</option></WorkspaceSelect></label>}
  </div>
  {mode!=='interventions'&&<ViewChoices label="Learning workspace views" options={views} value={view} onChange={setView}/>}
  {error&&<div className="learning-alert" role="alert">{error} <WorkspaceButton onClick={()=>refresh()}>Retry loading</WorkspaceButton></div>}{message&&<p role="status" className="learning-success"><CheckCircle size={16}/>{message}</p>}
  {loading?<Skeleton label="Loading authorized learning records"/>:data&&<>
   {!['assessments','stages','trends'].includes(view)&&<div className="learning-stats"><article><span>Learners in view</span><strong>{students.length}</strong></article><article><span>With recorded mastery</span><strong>{students.filter(s=>s.assessedTopics>0).length}</strong></article><article><span>Need topic support</span><strong>{students.filter(s=>s.failedTopics.length).length}</strong></article><article><span>Comparable assessment pairs</span><strong>{students.reduce((n,s)=>n+(Number.isFinite(s.gain)?1:0)+(s.evidence?.pairs.length||0),0)}</strong></article></div>}
   {mode==='diagnostics'&&<>
    {view==='topics'&&<section className="learning-card progress-topics"><h2>Topic coverage &amp; support</h2>
      <div className="topic-comparisons">{data.topics.map(t=><article key={t.topic}>
        <h3>{t.topic}</h3><div className="topic-estimate"><span>Mean mastery</span><strong>{pct(t.mastery)}</strong>
          <div className="learning-meter">{Number.isFinite(t.mastery)&&<span style={{width:pct(t.mastery)}}/>}</div></div>
        <div className="topic-support"><strong>{t.support} of {t.assessed}</strong><span>assessed below 40%{t.supportProportion!=null?' ('+pct(t.supportProportion)+')':''}</span></div>
        <small>{t.unassessed} unassessed</small>
      </article>)}</div></section>}
    {head&&view==='comparisons'&&<section className="learning-card"><h2>Grade & section comparisons</h2><div className="learning-table-wrap" tabIndex={0} aria-label="Scrollable grade and section comparison"><table className="learning-table"><thead><tr><th>Group</th>{TOPICS.map(t=><th key={t}>{t}</th>)}</tr></thead><tbody>{[...data.grades.map(g=>({name:g.grade,topics:g.topics})),...data.comparisons].map((g,i)=><tr key={i}><th>{g.name}</th>{g.topics.map(t=><td key={t.topic}>{pct(t.mastery)}<small>{t.assessed} assessed · {t.support} need support</small></td>)}</tr>)}</tbody></table></div></section>}
    {view==='heatmap'&&<StudentMastery students={students} sectionName={sections.find(item=>item.id===section)?.name}/>}
   </>}
   {mode!=='interventions'&&['assessments','stages','trends'].includes(view)&&<LearningEvidence key={filters} data={data} view={view} filters={Object.fromEntries(new URLSearchParams(filters))}/>}
   {mode==='interventions'&&<div className="learning-two-col"><section className="learning-card"><h2><ClipboardList size={18}/> Record an action</h2><form className="learning-form" onSubmit={save}><label>Student<WorkspaceSelect required value={studentId} onChange={e=>{setStudentId(e.target.value);setBountyId('');}}><option value="">Select a learner</option>{students.map(s=><option key={s._id} value={s._id}>{s.name} · {s.section}</option>)}</WorkspaceSelect></label><label>Action<WorkspaceSelect value={kind} onChange={e=>setKind(e.target.value)}><option value="review">Reviewed learning needs</option><option value="remediation">Direct classroom remediation</option><option value="bounty-review">Reviewed mentor bounty</option></WorkspaceSelect></label><label>Topic<WorkspaceSelect value={topic} onChange={e=>setTopic(e.target.value)}>{TOPICS.map(t=><option key={t}>{t}</option>)}</WorkspaceSelect></label>{kind==='bounty-review'&&<label>Bounty<WorkspaceSelect required value={bountyId} onChange={e=>setBountyId(e.target.value)}><option value="">Select a bounty</option>{bounties.filter(b=>String(b.mentee_id)===studentId).map(b=><option key={b.id} value={b.id}>{b.topic} · {b.status}{b.cancelled_at?' · Cancelled':''}</option>)}</WorkspaceSelect></label>}<label>Review or remediation note<textarea required maxLength={5000} rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Describe the learning need and your next step."/></label>{kind==='remediation'&&<label>Scheduled date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>}<label>Outcome<WorkspaceSelect value={outcome} onChange={e=>setOutcome(e.target.value)}>{['Pending','In progress','Completed','Follow-up needed'].map(v=><option key={v}>{v}</option>)}</WorkspaceSelect></label><button className="learning-button" disabled={busy||!students.length}>{busy?'Saving…':kind==='review'?'Mark reviewed':'Save action'}</button></form></section><section className="learning-card"><h2>Recorded actions</h2><p>Teacher review is separate from student confirmation of mentoring.</p>{!notes.length?<p className="dash-empty">No recorded action in this selection.</p>:notes.map(n=><article className="learning-note" key={n.id}><strong>{students.find(s=>String(s._id)===n.student_id)?.name||'Learner'} · {n.topic}</strong><small>{n.kind} · {new Date(n.created_at).toLocaleString()}</small><p>{n.note}</p>{n.scheduled_date&&<small>Scheduled: {n.scheduled_date}</small>}<label>Outcome<WorkspaceSelect disabled={busy} value={n.outcome} onChange={e=>update(n.id,e.target.value)}>{['Pending','In progress','Completed','Follow-up needed'].map(v=><option key={v}>{v}</option>)}</WorkspaceSelect></label></article>)}</section></div>}
   {reporting&&view==='export'&&<section className="learning-card learning-report export-studio">
      <div className="report-sheet"><FileText size={28} aria-hidden="true"/><h2>{studentId?'Individual progress report':head?'Institutional learning report':'Individual progress report'}</h2>
        <p>{[grade,sections.find(s=>s.id===section)?.name].filter(Boolean).join(' · ') || (head?'School-wide':'Assigned sections')}</p>
        <dl><div><dt>Records</dt><dd>Scores, mastery and interventions</dd></div><div><dt>Learning gains</dt><dd>Comparable assessment pairs</dd></div></dl>
      </div>
      <div className="report-options"><h3>Export learning evidence</h3><label>Report scope<WorkspaceSelect value={studentId} onChange={e=>setStudentId(e.target.value)}><option value="">{head?'Institutional report for the selected filters':'Select a student'}</option>{students.map(s=><option key={s._id} value={s._id}>{s.name} · {s.section}</option>)}</WorkspaceSelect></label>
        <div className="report-formats">{['pdf','csv'].map(format=>{const Icon=format==='pdf'?FileText:FileSpreadsheet;return <button key={format} type="button" disabled={busy||(!head&&!studentId)} onClick={()=>download(format)}>
          <Icon aria-hidden="true"/><span><strong>Download {format.toUpperCase()}</strong><small>{format==='pdf'?'Print or share a progress sheet':'Open records in a spreadsheet'}</small></span><Download size={17} aria-hidden="true"/>
        </button>;})}</div></div>
    </section>}
   <p className="dash-footnote">Missing records stay Not recorded. These figures are not exam grades.</p>
  </>}
 </div>;
}
