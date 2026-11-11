import {allRows,result} from './access.js';
import {MODULE_TOPICS} from './developerAnalytics.js';
// Grade 11 readiness is the first completion of all five chapters in each of the five modules, recorded by the
// mobile app as kind='chapter' learning records. Pre-tests, mastery and legacy stage results are separate
// measures and never count. The database enforces the same rule (levelblue_promotion_blocker); this summary
// only explains it to staff and is never accepted back from a client.
export const PROMOTION_MODULES=Object.entries(MODULE_TOPICS).map(([id,title])=>({id,title}));
export const CHAPTERS=[1,2,3,4,5];
const MISSING_SCHEMA=['42P01','42883','PGRST202','PGRST205'];

export function chapterOf(record){
 const chapter=Number(record?.data?.chapter);
 return record?.kind==='chapter'&&PROMOTION_MODULES.some(m=>m.id===record.module_id)&&CHAPTERS.includes(chapter)
  &&record.data.chapter_id===`${record.module_id}_ch_0${chapter}`?chapter:null;
}

export function moduleProgress(records=[]){
 return PROMOTION_MODULES.map(({id,title})=>{
  const completed=new Set(),assisted=new Set();
  for(const record of records){
   const chapter=record.module_id===id?chapterOf(record):null;
   if(!chapter)continue;
   completed.add(chapter);
   if(record.data.assist_status==='assisted')assisted.add(chapter);
  }
  const missing=CHAPTERS.filter(c=>!completed.has(c));
  return {moduleId:id,title,completedChapters:CHAPTERS.filter(c=>completed.has(c)),missingChapters:missing,assistedChapters:CHAPTERS.filter(c=>assisted.has(c)),
   status:!completed.size?'not-verified':missing.length?'incomplete':'complete'};
 });
}

// Null for students who are not Grade 11 candidates and were never promoted.
export function evaluateReadiness(student,{records=[],promoted=false,blocked=false}={}){
 if(promoted)return {status:'promoted',completedModules:null,modules:[],reasons:[],assisted:false};
 if(student?.enrollmentStatus!=='active'||student?.gradeLevel!=='Grade 11')return null;
 const modules=moduleProgress(records);
 const reasons=modules.filter(m=>m.status!=='complete').map(m=>m.status==='not-verified'
  ?`${m.title}: Completion Not Verified`
  :`${m.title}: chapter${m.missingChapters.length>1?'s':''} ${m.missingChapters.join(', ')} not completed`);
 if(blocked)reasons.push('An active mentor bounty must be resolved first');
 return {status:reasons.length?'not-ready':'ready',completedModules:modules.filter(m=>m.status==='complete').length,modules,reasons,
  assisted:modules.some(m=>m.assistedChapters.length>0)};
}

export async function chapterRecords(db,ids){
 const rows=[];
 try{
  for(let offset=0;offset<ids.length;offset+=100)
   rows.push(...await allRows(db.from('learning_records').select('student_id,kind,module_id,data').eq('kind','chapter').in('student_id',ids.slice(offset,offset+100)).order('student_id').order('id')));
 }catch(e){if(['42P01','PGRST205'].includes(e.code))return [];throw e;}
 return rows;
}

export async function promotionEnforced(db){
 try{return await result(db.rpc('levelblue_promotion_enforced'))===true;}
 catch(e){if(MISSING_SCHEMA.includes(e.code))return false;throw e;}
}

// Batched: one chapter query per 100 Grade 11 learners, independent of module count.
export async function attachReadiness(db,students,{history=[],blockedIds=[]}={}){
 const candidates=students.filter(s=>s.enrollmentStatus==='active'&&s.gradeLevel==='Grade 11').map(s=>String(s._id));
 const [records,enforced]=await Promise.all([chapterRecords(db,candidates),promotionEnforced(db)]);
 const byStudent=new Map();
 for(const row of records){const id=String(row.student_id);if(!byStudent.has(id))byStudent.set(id,[]);byStudent.get(id).push(row);}
 const promoted=new Set(history.filter(h=>h.action==='promote').map(h=>String(h.student_id))),blocked=new Set(blockedIds.map(String));
 return {enforced,students:students.map(s=>{const id=String(s._id);
  return {...s,readiness:evaluateReadiness(s,{records:byStudent.get(id)||[],promoted:promoted.has(id),blocked:blocked.has(id)})};})};
}
