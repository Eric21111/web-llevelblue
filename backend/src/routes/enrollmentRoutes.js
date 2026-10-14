import express from 'express';
import {fail,handler,learners,result,rowsForIds,sectionScope,staffOnly} from '../services/access.js';
export function createEnrollmentRoutes(db) {
 const router=express.Router();router.use(staffOnly);
 router.get('/',handler(async(req,res)=>{
  const data=await learners(db,req.user,{sectionId:req.query.sectionId,enrollment:'all'});
  // Explicit schema check: never offer a working-looking checklist before migration.
  await result(db.from('students').select('enrollment_version').limit(1));
  const ids=data.students.map(s=>String(s._id));
  const history=(await rowsForIds(db,'enrollment_history','student_id',ids)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
  res.json({...data,history});
 }));
 router.post('/',handler(async(req,res)=>{
  const {requestId,action,sourceId,targetId,fromYear,toYear,students}=req.body;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId||'')||!['promote','graduate'].includes(action)||typeof sourceId!=='string'||!Array.isArray(students)||!students.length||students.length>500||new Set(students.map(s=>s?.id)).size!==students.length||students.some(s=>typeof s?.id!=='string'||!Number.isInteger(s.version)||s.version<0))throw fail(400,'Choose a valid checklist and reload student versions.');
  await sectionScope(db,req.user,{sectionId:sourceId});
  if(action==='promote'){if(typeof targetId!=='string'||!targetId)throw fail(400,'Choose a destination section.');await sectionScope(db,req.user,{sectionId:targetId});}
  res.json(await result(db.rpc('levelblue_transition_enrollment',{p_actor:String(req.user.id),p_batch:requestId,p_request:{action,sourceId,targetId:action==='promote'?targetId:null,fromYear,toYear:action==='promote'?toYear:null,students}})));
 }));
 return router;
}
