import express from 'express';
import {fail,handler,learners,result,allRows,rowsForIds,sectionScope,staffOnly} from '../services/access.js';
const academicYear=value=>typeof value==='string'&&/^20\d{2}-20\d{2}$/.test(value)&&Number(value.slice(5))===Number(value.slice(0,4))+1;
async function enrollmentResult(query){
 try{return await result(query);}catch(e){
  if(['PGRST202','42883'].includes(e.code))throw fail(503,'Apply 20261106_cohort_promotion.sql before continuing.');
  if(e.code==='P0001')throw fail(409,e.message);
  if(e.code==='42501')throw fail(403,'This enrollment change is outside your permissions.');
  throw e;
 }
}
export function createEnrollmentRoutes(db) {
 const router=express.Router();router.use(staffOnly);
 router.get('/',handler(async(req,res)=>{
  const data=await learners(db,req.user,{sectionId:req.query.sectionId,enrollment:'all'});
  await result(db.from('students').select('enrollment_version').limit(1));
  const ids=data.students.map(s=>String(s._id)),sectionIds=data.sections.map(s=>s.scope_id);
  const [currentHistory,outgoingHistory,destinations,menteeBounties,mentorBounties]=await Promise.all([
   rowsForIds(db,'enrollment_history','student_id',ids),
   rowsForIds(db,'enrollment_history','from_section',sectionIds),
   allRows(db.from('sections').select('scope_id,name,grade_level').eq('grade_level','Grade 12').order('scope_id')),
   rowsForIds(db,'support_bounties','mentee_id',ids,'id,mentor_id,mentee_id,status,cancelled_at'),
   rowsForIds(db,'support_bounties','mentor_id',ids,'id,mentor_id,mentee_id,status,cancelled_at')
  ]);
  // Historical names identify recorded moves, without exposing the new roster or progress.
  const history=[...new Map([...currentHistory,...outgoingHistory].map(row=>[row.id,row])).values()].sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  const [names,sectionNames]=await Promise.all([
   rowsForIds(db,'students','id',[...new Set(history.map(row=>row.student_id))],'id,name'),
   rowsForIds(db,'sections','scope_id',[...new Set(history.flatMap(row=>[row.from_section,row.to_section]).filter(Boolean))],'id,scope_id,name')
  ]);
  const nameMap=new Map(names.map(row=>[String(row.id),row.name])),sectionMap=new Map(sectionNames.map(row=>[row.scope_id,row.name]));
  const blocked=new Set([...menteeBounties,...mentorBounties].filter(row=>!row.cancelled_at&&['PENDING','AWAITING_LINK','ACCEPTED'].includes(row.status)).flatMap(row=>[String(row.mentor_id),String(row.mentee_id)]));
  res.json({...data,destinations:destinations.map(row=>({scope_id:row.scope_id,name:row.name,grade_level:row.grade_level})),blockedStudentIds:ids.filter(id=>blocked.has(id)),history:history.map(row=>({...row,studentName:nameMap.get(String(row.student_id))||'Learner',sourceName:sectionMap.get(row.from_section)||'Previous section',targetName:sectionMap.get(row.to_section)||null}))});
 }));
 router.post('/',handler(async(req,res)=>{
  const {requestId,action,sourceId,targetId,fromYear,toYear,students}=req.body;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId||'')||!['promote','graduate'].includes(action)||typeof sourceId!=='string'||!sourceId||!Array.isArray(students)||!students.length||students.length>500||new Set(students.map(s=>s?.id)).size!==students.length||students.some(s=>typeof s?.id!=='string'||!s.id||!Number.isInteger(s.version)||s.version<0))throw fail(400,'Choose a valid checklist and reload student versions.');
  if(!academicYear(fromYear)||(action==='promote'&&(!academicYear(toYear)||Number(toYear.slice(0,4))!==Number(fromYear.slice(0,4))+1)))throw fail(400,'Use consecutive academic years, such as 2026-2027 followed by 2027-2028.');
  await sectionScope(db,req.user,{sectionId:sourceId});
  if(action==='promote'){
   if(typeof targetId!=='string'||!targetId||targetId===sourceId)throw fail(400,'Choose a different Grade 12 destination section.');
   const destination=await result(db.from('sections').select('scope_id,grade_level').eq('scope_id',targetId).maybeSingle());
   if(destination?.grade_level!=='Grade 12')throw fail(400,'Choose an existing Grade 12 destination section.');
  }
  res.json(await enrollmentResult(db.rpc('levelblue_transition_enrollment',{p_actor:String(req.user.id),p_batch:requestId,p_request:{action,sourceId,targetId:action==='promote'?targetId:null,fromYear,toYear:action==='promote'?toYear:null,students}})));
 }));
 return router;
}
