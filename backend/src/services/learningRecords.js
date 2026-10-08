import {rowsForIds} from './access.js';

export const RECORD_LIMITATION = 'Records start with the updated mobile app. Device dates and gameplay results are mobile-reported. Pre-tests are server-graded. Different test instruments are not automatically comparable. Program completion is unavailable until a required curriculum is defined.';

export function summarizeEvidence(records = []) {
  const ordered = [...records].sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at)||String(a.event_id).localeCompare(String(b.event_id)));
  const assessments = ordered.filter(r=>['pretest','posttest'].includes(r.kind) && r.data?.completed === true && Number.isFinite(r.data.score));
  // Select the first complete post-test after a baseline for the same module,
  // scale and explicitly approved comparison key. Never use a best-score gain.
  const pairs = [];
  for (const moduleId of new Set(assessments.map(r=>r.module_id))) {
    const pre = assessments.find(r=>r.module_id===moduleId&&r.kind==='pretest'&&r.data.comparison_key);
    const post = pre && assessments.find(r=>r.module_id===moduleId&&r.kind==='posttest'&&r.data.comparison_key===pre.data.comparison_key&&r.data.scale===pre.data.scale&&Date.parse(r.occurred_at)>=Date.parse(pre.occurred_at));
    if (post) pairs.push({moduleId,scale:pre.data.scale,comparisonKey:pre.data.comparison_key,pre:pre.data.score,post:post.data.score,gain:post.data.score-pre.data.score,preEvent:pre.event_id,postEvent:post.event_id});
  }
  const attempts = new Map();
  for (const row of ordered.filter(r=>r.kind==='stage')) {
    const key = `${row.module_id}:${row.data.attempt_id}`;
    const old = attempts.get(key);
    // A late-uploaded start must never erase a terminal result.
    if (!old || old.data.outcome==='started') attempts.set(key,row);
  }
  const stages = [...attempts.values()];
  const finished = stages.filter(r=>['cleared','failed'].includes(r.data.outcome));
  const cleared = finished.filter(r=>r.data.outcome==='cleared');
  const observations = ordered.filter(r=>r.kind==='mastery'&&typeof r.data.mastery==='number');
  return {assessments,pairs,attempts:stages,observations,started:stages.length,finished:finished.length,
    cleared:cleared.length,failed:finished.length-cleared.length,
    incomplete:stages.length-finished.length,
    uniqueStagesCleared:new Set(cleared.map(r=>`${r.module_id}:${r.data.stage}`)).size,
    clearanceRate:finished.length?cleared.length/finished.length:null};
}

export async function attachLearningEvidence(db, data) {
  const ids=data.students.map(s=>String(s._id));
  let records=[];
  try { records=await rowsForIds(db,'learning_records','student_id',ids); }
  catch(error) {
    if(!['42P01','PGRST205'].includes(error.code)) throw error;
    return {...data,evidence:{available:false,message:'Learning records are not enabled yet. Apply the learning-records migration.'}};
  }
  const students=data.students.map(s=>({...s,evidence:summarizeEvidence(records.filter(r=>String(r.student_id)===String(s._id)))}));
  // Each learner contributes at most one observation per topic per UTC date.
  // Dates without observations are omitted; this is not a cohort growth estimate.
  const daily=new Map();
  for(const r of [...records].sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at))) {
    if(r.kind!=='mastery')continue;
    daily.set(`${r.occurred_at.slice(0,10)}:${r.module_id}:${r.student_id}`,r);
  }
  const groups=new Map();
  for(const r of daily.values()) {
    const key=`${r.occurred_at.slice(0,10)}:${r.module_id}`;
    const group=groups.get(key)||{date:r.occurred_at.slice(0,10),topic:r.data.topic,count:0,total:0};
    group.count++;group.total+=r.data.mastery;groups.set(key,group);
  }
  return {...data,students,evidence:{available:true,recordCount:records.length,
    assessments:students.reduce((n,s)=>n+s.evidence.assessments.length,0),
    pairs:students.reduce((n,s)=>n+s.evidence.pairs.length,0),
    attempts:students.reduce((n,s)=>n+s.evidence.started,0),
    cleared:students.reduce((n,s)=>n+s.evidence.cleared,0),
    finished:students.reduce((n,s)=>n+s.evidence.finished,0),
    trends:[...groups.values()].map(g=>({date:g.date,topic:g.topic,assessed:g.count,mastery:g.total/g.count})),
    limitation:RECORD_LIMITATION}};
}
