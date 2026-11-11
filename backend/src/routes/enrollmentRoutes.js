import express from 'express';
import {fail,handler,learners,result,allRows,rowsForIds,sectionScope,staffOnly,headOnly} from '../services/access.js';
const academicYear=value=>typeof value==='string'&&/^20\d{2}-20\d{2}$/.test(value)&&Number(value.slice(5))===Number(value.slice(0,4))+1;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validPlanStudents=students=>Array.isArray(students)&&students.length>0&&students.length<=20000&&new Set(students.map(s=>s?.id)).size===students.length&&students.every(s=>typeof s?.id==='string'&&s.id&&Number.isInteger(s.version)&&s.version>=0);
const validDestinations=value=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length<=500&&Object.entries(value).every(([source,target])=>source&&typeof target==='string'&&target&&target!==source);
async function enrollmentResult(query,migration='20261106_cohort_promotion.sql',duplicate='This section already has a pending schedule. Cancel it before creating another.'){
 try{return await result(query);}catch(e){
  if(['PGRST202','PGRST205','42883','42P01','42703'].includes(e.code))throw fail(503,`Apply ${migration} before continuing.`);
  if(e.code==='P0001')throw fail(409,e.message);
  if(e.code==='P0002')throw fail(404,e.message);
  if(e.code==='23505')throw fail(409,duplicate);
  if(e.code==='42501')throw fail(403,'This enlistment change is outside your permissions.');
  throw e;
 }
}
const SCHEDULE_MIGRATION='20261107_enrollment_schedules.sql';
const ADVANCEMENT_MIGRATION='20261108_school_advancement.sql';
const PLAN_PENDING='An automatic advancement plan is already pending. Cancel it before creating another.';
function scheduleView(row,sectionNames){
 const result=row.result||{};
 return {id:row.id,action:row.action,status:row.status,runOn:row.run_on,fromYear:row.from_year,toYear:row.to_year,
  sourceId:row.source_section,sourceName:sectionNames.get(row.source_section)||'Section',targetId:row.target_section,targetName:row.target_section?sectionNames.get(row.target_section)||'Section':null,
  studentCount:Array.isArray(row.students)?row.students.length:0,createdAt:row.created_at,cancelledAt:row.cancelled_at,executedAt:row.executed_at,
  processed:Number.isInteger(result.processed)?result.processed:null,skipped:Array.isArray(result.skipped)?result.skipped.length:0,error:typeof result.error==='string'?result.error:null};
}
function planView(plan,sectionRows,studentNames,sectionNames){
 const learner=id=>studentNames.get(String(id))||'Learner',summary=plan.summary||{};
 return {id:plan.id,status:plan.status,fromYear:plan.from_year,toYear:plan.to_year,runOn:plan.run_on,createdAt:plan.created_at,cancelledAt:plan.cancelled_at,executedAt:plan.executed_at,
  promote:summary.promote??0,graduate:summary.graduate??0,result:plan.result||null,
  exclusions:(plan.exclusions||[]).map(x=>({name:learner(x.id),sectionName:x.sectionId?sectionNames.get(x.sectionId)||'Section':'No section',reason:x.reason})),
  sections:sectionRows.map(row=>({...scheduleView(row,sectionNames),skippedStudents:(row.result?.skipped||[]).map(x=>({name:learner(x.id),reason:x.reason}))}))
   .sort((a,b)=>a.action===b.action?a.sourceName.localeCompare(b.sourceName):a.action==='promote'?-1:1)};
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
 // Plans run only from the database scheduler; there is deliberately no HTTP route that executes them.
 router.get('/advancement',headOnly,handler(async(_req,res)=>{
  const plans=await enrollmentResult(db.from('enrollment_advancement_plans').select('*').order('created_at',{ascending:false}).limit(20),ADVANCEMENT_MIGRATION);
  const [sectionRows,legacyRows]=await Promise.all([
   rowsForIds(db,'enrollment_schedules','plan_id',plans.map(p=>p.id)),
   enrollmentResult(db.from('enrollment_schedules').select('*').is('plan_id',null).eq('status','pending').order('run_on'),ADVANCEMENT_MIGRATION)
  ]);
  const studentIds=[...new Set([...plans.flatMap(p=>(p.exclusions||[]).map(x=>x.id)),...sectionRows.flatMap(r=>(r.result?.skipped||[]).map(x=>x.id))].filter(Boolean).map(String))];
  const sectionIds=[...new Set([...sectionRows,...legacyRows].flatMap(r=>[r.source_section,r.target_section]).concat(plans.flatMap(p=>(p.exclusions||[]).map(x=>x.sectionId))).filter(Boolean))];
  const [students,sections]=await Promise.all([rowsForIds(db,'students','id',studentIds,'id,name'),rowsForIds(db,'sections','scope_id',sectionIds,'scope_id,name')]);
  const studentNames=new Map(students.map(s=>[String(s.id),s.name])),sectionNames=new Map(sections.map(s=>[s.scope_id,s.name]));
  res.setHeader('Cache-Control','no-store');
  res.json({plans:plans.map(p=>planView(p,sectionRows.filter(r=>r.plan_id===p.id),studentNames,sectionNames)),legacySchedules:legacyRows.map(r=>scheduleView(r,sectionNames))});
 }));
 router.get('/advancement/preview',headOnly,handler(async(req,res)=>{
  const fromYear=typeof req.query.fromYear==='string'&&req.query.fromYear?req.query.fromYear:null;
  if(fromYear&&!academicYear(fromYear))throw fail(400,'Use the current academic year, such as 2026-2027.');
  res.setHeader('Cache-Control','no-store');
  res.json(await enrollmentResult(db.rpc('levelblue_preview_school_advancement',{p_actor:String(req.user.id),p_from_year:fromYear}),ADVANCEMENT_MIGRATION));
 }));
 router.post('/advancement',headOnly,handler(async(req,res)=>{
  const {fromYear,runOn,destinations,students}=req.body||{};
  if(!academicYear(fromYear))throw fail(400,'Use the current academic year, such as 2026-2027.');
  if(typeof runOn!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(runOn))throw fail(400,'Choose a valid date.');
  if(!validDestinations(destinations))throw fail(400,'Choose a Grade 12 destination for each Grade 11 section.');
  if(!validPlanStudents(students))throw fail(400,'Refresh the preview and review the affected students again.');
  const plan=await enrollmentResult(db.rpc('levelblue_create_school_advancement',{p_actor:String(req.user.id),p_request:{fromYear,runOn,destinations,students}}),ADVANCEMENT_MIGRATION,PLAN_PENDING);
  res.status(201).json({id:plan.id,status:plan.status,runOn:plan.run_on,fromYear:plan.from_year,toYear:plan.to_year,promote:plan.summary?.promote??0,graduate:plan.summary?.graduate??0,excluded:(plan.exclusions||[]).length});
 }));
 router.post('/advancement/:id/cancel',headOnly,handler(async(req,res)=>{
  if(!UUID.test(req.params.id))throw fail(404,'Advancement plan not found');
  const plan=await enrollmentResult(db.rpc('levelblue_cancel_school_advancement',{p_actor:String(req.user.id),p_plan:req.params.id}),ADVANCEMENT_MIGRATION);
  res.json({id:plan.id,status:plan.status,cancelledAt:plan.cancelled_at});
 }));
 // Individual section schedules are no longer created; ones made before school-wide plans can still be cancelled.
 router.post('/schedules/:id/cancel',headOnly,handler(async(req,res)=>{
  if(!UUID.test(req.params.id))throw fail(404,'Schedule not found');
  const row=await enrollmentResult(db.rpc('levelblue_cancel_enrollment_schedule',{p_actor:String(req.user.id),p_schedule:req.params.id}),SCHEDULE_MIGRATION);
  res.json({id:row.id,status:row.status,cancelledAt:row.cancelled_at});
 }));
 return router;
}
