import WorkspaceSelect from './WorkspaceSelect';
import {useWorkspaceQuery} from '../hooks/useWorkspaceQuery';
import {ClipboardCheck, Gamepad2, GitCompareArrows, Flag} from 'lucide-react';
import Skeleton from './Skeleton';
import {useState} from 'react';
import StageEvidence from './StageEvidence';
import AssessmentEvaluation from './AssessmentEvaluation';

const percent=value=>value==null?'Unavailable':`${(value*100).toFixed(1)}%`;
const date=value=>new Date(value).toLocaleString();
export default function LearningEvidence({data:provided,compact=false,sectionName='',onNavigate,detailsPath='/analytics',view='all',filters={}}) {
 const [learner,setLearner]=useState('');
 const {data:{records:loaded},errors:{records:error},refresh}=useWorkspaceQuery(provided?{}:{records:'/api/analytics'});
 const data=provided||loaded;
 if(error)return <section className="learning-card" role="alert"><h2>Learning evidence</h2><p>{error}</p><button className="learning-button secondary" onClick={refresh}>Retry</button></section>;
 if(!data)return <Skeleton label="Loading learning evidence"/>;
 if(!data.evidence?.available)return <section className="learning-card"><h2>Learning evidence</h2><p>{data.evidence?.message||'Learning records are unavailable.'}</p></section>;
 const students=data.students.filter(s=>(!sectionName||s.section===sectionName)&&(!learner||s._id===learner));
 const assessments=students.flatMap(s=>(s.evidence?.assessments||[]).map(r=>({...r,name:s.name})));
 const attempts=students.flatMap(s=>(s.evidence?.attempts||[]).map(r=>({...r,name:s.name})));
 const pairs=students.flatMap(s=>(s.evidence?.pairs||[]).map(p=>({...p,name:s.name})));
 const finished=attempts.filter(r=>['cleared','failed'].includes(r.data.outcome));
 const cleared=finished.filter(r=>r.data.outcome==='cleared');
 const learnerDays=new Map();
 if(learner)for(const r of students.flatMap(s=>s.evidence.observations)){
  const day=new Date(r.occurred_at).toISOString().slice(0,10);
  learnerDays.set(`${day}:${r.data.topic}`,{date:day,topic:r.data.topic,assessed:1,mastery:r.data.mastery});
 }
 const trends=learner?[...learnerDays.values()]:data.evidence.trends;
 if (compact) {
   const outcomes = [
     {label:'Completed assessments', value:assessments.length, icon:ClipboardCheck},
     {label:'Recorded attempts', value:attempts.length, icon:Gamepad2},
     {label:'Comparable module pairs', value:pairs.length, icon:GitCompareArrows},
   ];
   return <section className="learning-card outcomes-card">
     <header className="dash-card-header"><div><h2>All-time recorded learning outcomes</h2><p>Evidence received from the mobile app.</p></div>
       <button className="dash-text-button" onClick={()=>onNavigate?.(detailsPath)}>Explore learning records</button>
     </header>
     <div className="outcome-grid">{outcomes.map(({label,value,icon:Icon})=>
       <div key={label}><Icon size={18} aria-hidden="true"/><strong>{value}</strong><span>{label}</span></div>)}
       <div><Flag size={18} aria-hidden="true"/><strong>{finished.length ? percent(cleared.length/finished.length) : '—'}</strong>
         <span>{cleared.length} cleared / {finished.length} finished attempts</span>
         {finished.length>0 && <div className="learning-meter"><span style={{width:percent(cleared.length/finished.length)}}/></div>}
       </div>
     </div>
   </section>;
 }
 return <section className="learning-card learning-evidence">
  <h2>Recorded learning outcomes</h2><p>Evidence received from the mobile app. Earlier activity may not have records.</p>
  <div className="learning-stats"><article><span>Completed assessments</span><strong>{assessments.length}</strong></article><article><span>Recorded attempts</span><strong>{attempts.length}</strong></article><article><span>Cleared / finished attempts</span><strong>{cleared.length} / {finished.length}</strong><small>{percent(finished.length?cleared.length/finished.length:null)}</small></article><article><span>Comparable module pairs</span><strong>{pairs.length}</strong></article></div>
   <label className="learning-evidence-filter">Learner<WorkspaceSelect value={learner} onChange={e=>setLearner(e.target.value)}><option value="">All learners in this selection</option>{data.students.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</WorkspaceSelect></label>
   {['all','assessments'].includes(view)&&<AssessmentEvaluation students={students} pairs={pairs} filters={{...filters,...learner&&{studentId:learner}}}/>}
   {['all','stages'].includes(view)&&<><h3>Stage attempts</h3>{!attempts.length?<p className="dash-empty">No recorded stage attempts.</p>:<div className="learning-table-wrap" tabIndex={0} aria-label="Stage attempt records"><table className="learning-table"><thead><tr><th>Learner</th><th>Topic / stage</th><th>Outcome</th><th>Device time</th><th>Attempt evidence</th></tr></thead><tbody>{attempts.map(r=><tr key={r.id}><th>{r.name}</th><td>{r.data.topic} · {r.data.stage}</td><td>{r.data.outcome==='started'?'No result received':r.data.outcome==='abandoned'?'Left before result':r.data.outcome}</td><td>{date(r.occurred_at)}</td><td><StageEvidence record={r}/></td></tr>)}</tbody></table></div>}
   </>}
   {['all','trends'].includes(view)&&<><h3>Dated mastery observations</h3><p>Daily mean of each learner’s last observation for that topic. Participants may differ between dates; this is not a matched-cohort gain.</p>
   {!trends.length?<p className="dash-empty">No dated observations yet.</p>:<div className="learning-table-wrap" tabIndex={0} aria-label="Dated mastery observations"><table className="learning-table"><thead><tr><th>Date (UTC)</th><th>Topic</th><th>Learners observed</th><th>Mean mastery</th></tr></thead><tbody>{trends.map((r,i)=><tr key={i}><td>{r.date}</td><th>{r.topic}</th><td>{r.assessed}</td><td>{percent(r.mastery)}</td></tr>)}</tbody></table></div>}
   </>}
  <p className="dash-footnote">{data.evidence.limitation}</p>
 </section>;
}
