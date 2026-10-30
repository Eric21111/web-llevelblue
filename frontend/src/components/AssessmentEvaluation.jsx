import {useEffect,useState} from 'react';
import {apiRequest,apiFetch} from '../utils/api';
import {WorkspaceButton} from './WorkspaceUI';
import {SupportDialog,SupportPagination,useSupportPage} from './SupportUI';
import '../styles/support.css';

const topics={mod_01:'Phishing',mod_02:'Smishing',mod_03:'Vishing',mod_04:'Pretexting',mod_05:'Baiting'};
const score=value=>Number.isFinite(value)?`${value.toFixed(1)}%`:'Unavailable';
const date=value=>value?new Date(value).toLocaleString():'Unavailable';
export default function AssessmentEvaluation({students,pairs,filters={}}){
 const [kind,setKind]=useState(''),[moduleId,setModuleId]=useState(''),[selected,setSelected]=useState(null),[detail,setDetail]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const rows=students.flatMap(s=>(s.evidence?.assessments||[]).map(r=>({...r,name:s.name,section:s.section}))).filter(r=>(!kind||r.kind===kind)&&(!moduleId||r.module_id===moduleId)).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at)));
 const page=useSupportPage(rows,`${kind}|${moduleId}|${students.map(s=>s._id).join(',')}`);
 useEffect(()=>{if(!selected)return;const controller=new AbortController();setDetail(null);setError('');apiRequest(`/api/assessments/${encodeURIComponent(selected.id)}`,{signal:controller.signal}).then(setDetail).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[selected]);
 async function download(){setBusy(true);setError('');try{
  const query=new URLSearchParams({...filters,...kind&&{kind},...moduleId&&{moduleId}});
  const response=await apiFetch(`/api/assessments/export?${query}`);
  if(!response.ok)throw new Error((await response.json()).error||'Export failed.');
  const url=URL.createObjectURL(await response.blob()),link=document.createElement('a');link.href=url;link.download='LEVELBLUE-assessment-responses.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="support-workspace"><h3>Assessment evaluation</h3><p>Every recorded completed attempt, including retries. Review scores and the answers saved with each attempt.</p>
  <div className="support-filters"><label>Assessment<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Pre-tests & post-tests</option><option value="pretest">Pre-test</option><option value="posttest">Post-test</option></select></label><label>Module<select value={moduleId} onChange={e=>setModuleId(e.target.value)}><option value="">All modules</option>{Object.entries(topics).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><WorkspaceButton disabled={busy||!rows.length} onClick={download}>{busy?'Preparing…':'Export scores & answers (CSV)'}</WorkspaceButton></div>
  {!selected&&error&&<p role="alert" className="support-error">{error}</p>}
  {!rows.length?<p>No assessments recorded for this selection. Missing records are not zero scores.</p>:<div className="learning-table-wrap" tabIndex={0} aria-label="Assessment evaluation"><table className="learning-table"><thead><tr><th>Learner / module</th><th>Assessment</th><th>Score</th><th>Recorded date</th><th>Responses</th></tr></thead><tbody>{page.items.map(r=><tr key={r.id||r.event_id}><th>{r.name}<small>{r.section} · {topics[r.module_id]}</small></th><td>{r.kind==='pretest'?'Pre-test':'Post-test'}<small>{r.data.instrument}</small></td><td>{r.data.correct} / {r.data.total}<small>{score(r.data.score)}</small></td><td>{date(r.occurred_at)}<small>{r.data.source==='server-graded'?'Server graded':'Mobile reported'}</small></td><td><WorkspaceButton onClick={()=>setSelected(r)}>Review attempt</WorkspaceButton><small>{r.data.response_count||0} / {r.data.total} answers recorded</small></td></tr>)}</tbody></table></div>}
  <SupportPagination state={page}/>
  <h3>Confirmed learning gains</h3>{!pairs.filter(p=>!moduleId||p.moduleId===moduleId).length?<p>No confirmed comparable pair yet. Module checkpoints and stage exams use different instruments from the pre-test; percentage differences alone do not establish knowledge gain.</p>:<ul>{pairs.filter(p=>!moduleId||p.moduleId===moduleId).map((p,i)=><li key={i}>{p.name} · {topics[p.moduleId]}: {score(p.pre)} → {score(p.post)} ({p.gain.toFixed(1)} percentage points)</li>)}</ul>}
  {selected&&<SupportDialog title={`Assessment · ${selected.name}`} onClose={()=>setSelected(null)}>{error?<p className="support-error" role="alert">{error}<WorkspaceButton onClick={()=>setSelected({...selected})}>Retry</WorkspaceButton></p>:!detail?<p role="status">Loading recorded answers…</p>:<><p>{topics[detail.module_id]} · {detail.kind==='pretest'?'Pre-test':'Post-test'} · {detail.data.correct} / {detail.data.total} ({score(detail.data.score)})</p><p>{detail.data.source==='server-graded'?'Server graded':'Mobile-reported questions and grading'} · Received {date(detail.received_at)}</p>{!detail.data.responses?.length?<p>This attempt has a score, but its answers were not recorded. Earlier responses cannot be reconstructed.</p>:<ol>{detail.data.responses.map((r,i)=><li key={`${r.question_id}-${i}`} className="support-context"><strong style={{whiteSpace:'pre-wrap'}}>{r.prompt}</strong>{r.options?.length>0&&<p style={{whiteSpace:'pre-wrap'}}>Options: {r.options.join(' · ')}</p>}<p><b>Student answer:</b> {r.selected_answer??'Not recorded'}</p><p><b>Correct answer:</b> {r.correct_answer??'Not recorded'}</p><p><b>Result:</b> {r.correct===true?'Correct':r.correct===false?'Incorrect':'Unscored'}</p></li>)}</ol>}</>}</SupportDialog>}
 </div>;
}
