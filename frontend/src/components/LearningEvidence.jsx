import {useEffect,useState} from 'react';
import {apiRequest} from '../utils/api';

const percent=value=>value==null?'Unavailable':`${(value*100).toFixed(1)}%`;
const date=value=>new Date(value).toLocaleString();
export default function LearningEvidence({data:provided,compact=false,sectionName='',onNavigate,detailsPath='/analytics'}) {
 const [loaded,setLoaded]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[learner,setLearner]=useState('');
 useEffect(()=>{
  if(provided)return;
  const controller=new AbortController();setError('');setLoaded(null);
  apiRequest('/api/analytics',{signal:controller.signal}).then(setLoaded).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
  return()=>controller.abort();
 },[provided,revision]);
 const data=provided||loaded;
 if(error)return <section className="learning-card" role="alert"><h2>Learning evidence</h2><p>{error}</p><button className="learning-button secondary" onClick={()=>setRevision(v=>v+1)}>Retry</button></section>;
 if(!data)return <section className="learning-card" role="status">Loading learning evidence…</section>;
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
 return <section className="learning-card learning-evidence">
  <h2>Recorded learning outcomes</h2><p>Evidence received from the mobile app. Earlier activity may not have records.</p>
  <div className="learning-stats"><article><span>Completed assessments</span><strong>{assessments.length}</strong></article><article><span>Recorded attempts</span><strong>{attempts.length}</strong></article><article><span>Cleared / finished attempts</span><strong>{cleared.length} / {finished.length}</strong><small>{percent(finished.length?cleared.length/finished.length:null)}</small></article><article><span>Comparable module pairs</span><strong>{pairs.length}</strong></article></div>
  {compact?<button className="learning-button secondary" onClick={()=>onNavigate?.(detailsPath)}>Explore learning records</button>:<>
   <label className="learning-evidence-filter">Learner<select value={learner} onChange={e=>setLearner(e.target.value)}><option value="">All learners in this selection</option>{data.students.map(s=><option key={s._id} value={s._id}>{s.name}</option>)}</select></label>
   <h3>Completed assessments</h3>
   {!assessments.length?<p className="dash-empty">Not yet assessed in the recorded evidence. Missing scores are not zero scores.</p>:<div className="learning-table-wrap" tabIndex={0} aria-label="Assessment records"><table className="learning-table"><thead><tr><th>Learner / topic</th><th>Assessment</th><th>Score</th><th>Completed / received</th><th>Evidence</th></tr></thead><tbody>{assessments.map(r=><tr key={r.id}><th>{r.name}<small>{r.data.topic}</small></th><td>{r.kind==='pretest'?'Pre-test':'Post-test'}<small>{r.data.instrument}</small></td><td>{r.data.correct} / {r.data.total}<small>{r.data.score.toFixed(1)}%</small></td><td>{date(r.occurred_at)}<small>Received {date(r.received_at)}</small></td><td>{r.data.source==='server-graded'?'Server graded':'Mobile reported'}</td></tr>)}</tbody></table></div>}
   <h3>Comparable learning gains</h3>{!pairs.length?<p>No confirmed comparable pair yet. Pre-tests, lesson checkpoints, and stage exams use different instruments; equal percentage scales alone do not establish comparability.</p>:<ul>{pairs.map((p,i)=><li key={i}>{p.name} · {p.moduleId}: {p.pre.toFixed(1)} → {p.post.toFixed(1)} ({p.gain.toFixed(1)} gain, {p.scale})</li>)}</ul>}
   <h3>Stage attempts</h3>{!attempts.length?<p className="dash-empty">No recorded stage attempts.</p>:<div className="learning-table-wrap" tabIndex={0} aria-label="Stage attempt records"><table className="learning-table"><thead><tr><th>Learner</th><th>Topic / stage</th><th>Outcome</th><th>Device time</th></tr></thead><tbody>{attempts.map(r=><tr key={r.id}><th>{r.name}</th><td>{r.data.topic} · {r.data.stage}</td><td>{r.data.outcome==='started'?'No result received':r.data.outcome==='abandoned'?'Left before result':r.data.outcome}</td><td>{date(r.occurred_at)}</td></tr>)}</tbody></table></div>}
   <h3>Dated mastery observations</h3><p>Daily mean of each learner’s last observation for that topic. Participants may differ between dates; this is not a matched-cohort gain.</p>
   {!trends.length?<p className="dash-empty">No dated observations yet.</p>:<div className="learning-table-wrap" tabIndex={0} aria-label="Dated mastery observations"><table className="learning-table"><thead><tr><th>Date (UTC)</th><th>Topic</th><th>Learners observed</th><th>Mean mastery</th></tr></thead><tbody>{trends.map((r,i)=><tr key={i}><td>{r.date}</td><th>{r.topic}</th><td>{r.assessed}</td><td>{percent(r.mastery)}</td></tr>)}</tbody></table></div>}
  </>}
  {!compact&&<p className="dash-footnote">{data.evidence.limitation}</p>}
 </section>;
}
