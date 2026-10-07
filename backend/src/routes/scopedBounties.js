import express from 'express';
import {randomInt} from 'node:crypto';
import rateLimit from 'express-rate-limit';
import {handler,staffOnly,learners,requireLearner,result,allRows,fail} from '../services/access.js';
export const safeBounty = ({clearance_code,...data})=>data;
export function createBountyRoutes(db) {
 const router=express.Router();
 const all=()=>allRows(db.from('support_bounties').select('*, mentee:mentee_id(name,section), mentor:mentor_id(name,section)').order('id'));
 async function visible(req) {
   const rows=await all();
   if(req.user.role==='student') return rows.filter(b=>[String(b.mentor_id),String(b.mentee_id)].includes(String(req.user.id)));
   if(!['admin','super'].includes(req.user.role)||req.user.status!=='Active') throw fail(403,'Active staff account required.');
   const {students}=await learners(db,req.user); const ids=new Set(students.map(s=>String(s._id)));
   return rows.filter(b=>ids.has(String(b.mentor_id))&&ids.has(String(b.mentee_id)));
 }
 router.get('/',staffOnly,handler(async(req,res)=>res.json((await visible(req)).map(safeBounty))));
 router.get('/student/:id',handler(async(req,res)=>{
   if(req.user.role==='student'&&String(req.user.id)!==req.params.id) throw fail(403,'Only your own bounties are available.');
   if(req.user.role!=='student') requireLearner((await learners(db,req.user)).students,req.params.id);
   res.json((await visible(req)).filter(b=>[String(b.mentee_id),String(b.mentor_id)].includes(req.params.id)).map(safeBounty));
 }));
 router.post('/',staffOnly,handler(async(req,res)=>{
   const {students}=await learners(db,req.user);
   const mentor=requireLearner(students,req.body.mentor_id),mentee=requireLearner(students,req.body.mentee_id);
   const topics=req.body.topics;
   if(!Array.isArray(topics)||!topics.length||new Set(topics).size!==topics.length||mentor._id===mentee._id||!mentor.sectionId||mentor.sectionId!==mentee.sectionId||topics.some(t=>!mentee.failedTopics.includes(t)||mentor.mastery[t]===null||mentor.mastery[t]<=.9)) throw fail(400,'Choose a same-section mentor above 0.90 for each recorded topic below 0.40.');
   const data=await result(db.from('support_bounties').insert(topics.map(topic=>({mentor_id:mentor._id,mentee_id:mentee._id,topic,status:'PENDING',created_by:String(req.user.id)}))).select());
   res.status(201).json(data.map(safeBounty));
 }));
 router.delete('/:id',staffOnly,handler(async(req,res)=>{
   if(!(await visible(req)).some(b=>String(b.id)===req.params.id)) throw fail(404,'Bounty not available.');
   // Preserve the student's confirmation history. Cancellation is a staff action, not a completion.
   await result(db.from('support_bounties').update({cancelled_at:new Date().toISOString(),cancelled_by:String(req.user.id)}).eq('id',req.params.id));
   res.json({success:true});
 }));
 router.get('/mentee-code/:id',handler(async(req,res)=>{
   const b=(await visible(req)).find(b=>String(b.id)===req.params.id);
   if(!b||req.user.role!=='student'||String(b.mentee_id)!==String(req.user.id)) throw fail(404,'Bounty not available.');
   if(b.status!=='AWAITING_LINK'||b.cancelled_at) throw fail(409,'No active clearance code.');
   res.json({clearance_code:b.clearance_code,mentor_name:b.mentor?.name,topic:b.topic});
 }));
 const otpLimit=rateLimit({windowMs:15*60*1000,max:10,standardHeaders:true,legacyHeaders:false});
 async function transition(req,res,action) {
   const b=(await visible(req)).find(b=>String(b.id)===req.params.id);
   const isMentor=['accept','verify-otp'].includes(action);
   if(!b||req.user.role!=='student'||String(isMentor?b.mentor_id:b.mentee_id)!==String(req.user.id)) throw fail(404,'Bounty not available.');
   const expected=action==='accept'?'PENDING':action==='verify-otp'?'AWAITING_LINK':'ACCEPTED';
   if(b.cancelled_at||b.status!==expected) throw fail(409,'Bounty is not in the required state.');
   if(action==='verify-otp' && (typeof req.body.code!=='string'||req.body.code.trim()!==b.clearance_code)) throw fail(400,'Invalid clearance code.');
   const patch=action==='accept'?{status:'AWAITING_LINK',clearance_code:String(randomInt(1000,10000)),otp_verified:false}:action==='verify-otp'?{status:'ACCEPTED',otp_verified:true}:action==='validate'?{status:'VALIDATED',mentee_confirmed:true}:{status:'SELF_CLEARED',mentee_confirmed:false};
   const data=await result(db.from('support_bounties').update(patch).eq('id',b.id).eq('status',expected).is('cancelled_at',null).select().maybeSingle());
   if(!data) throw fail(409,'Bounty changed; refresh and retry.');
   res.json(safeBounty(data));
 }
 router.put('/:id/accept',handler((req,res)=>transition(req,res,'accept')));
 router.post('/:id/verify-otp',otpLimit,handler((req,res)=>transition(req,res,'verify-otp')));
 router.put('/:id/validate',handler((req,res)=>transition(req,res,'validate')));
 router.put('/:id/self-clear',handler((req,res)=>transition(req,res,'self-clear')));
 return router;
}
