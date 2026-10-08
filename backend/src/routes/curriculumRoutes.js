import express from 'express';
import {allRows,fail,handler,result,rowsForIds,staffOnly} from '../services/access.js';
import {validateContent} from '../services/curriculum.js';
export function createCurriculumRoutes(db){
 const router=express.Router();router.use(staffOnly);
 const withStaffNames=async(rows,key)=>{
  const users=await rowsForIds(db,'users','id',[...new Set(rows.map(r=>r[key]))],'id,name');
  const names=new Map(users.map(u=>[String(u.id),u.name]));
  return rows.map(r=>({...r,[key==='author_id'?'author_name':'actor_name']:names.get(r[key])||'Staff member'}));
 };
 const write=async(req,action,payload={})=>{
  try{return await result(db.rpc('levelblue_curriculum_write',{p_actor:String(req.user.id),p_action:action,p_revision:req.params.id||null,p_expected:req.body.version??null,p_payload:payload}));}
  catch(e){if(e.code==='P0001')throw fail(409,e.message);throw e;}
 };
 router.get('/',handler(async(req,res)=>{
  let query=db.from('curriculum_revisions').select('*').order('created_at',{ascending:false}).order('id');
  if(req.user.role==='admin')query=query.eq('author_id',String(req.user.id));
  res.json(await withStaffNames(await allRows(query),'author_id'));
 }));
 router.get('/catalog',handler(async(req,res)=>res.json(await result(db.rpc('levelblue_published_catalog')))));
 router.get('/:id/history',handler(async(req,res)=>{
  const revision=await result(db.from('curriculum_revisions').select('item_id,author_id').eq('id',req.params.id).maybeSingle());
  if(!revision||(req.user.role==='admin'&&revision.author_id!==String(req.user.id)))throw fail(404,'Content not available.');
  res.json(await withStaffNames(await allRows(db.from('curriculum_events').select('*').eq('item_id',revision.item_id).order('created_at').order('id')),'actor_id'));
 }));
 router.post('/',handler(async(req,res)=>{
  if(req.user.role!=='admin')throw fail(403,'Teachers author drafts; school heads review and publish them.');
  res.status(201).json(await write(req,'create',validateContent(req.body)));
 }));
 router.patch('/:id',handler(async(req,res)=>{
  const existing=await result(db.from('curriculum_revisions').select('*').eq('id',req.params.id).maybeSingle());
  if(!existing||req.user.role!=='admin'||existing.author_id!==String(req.user.id))throw fail(404,'Draft not available.');
  if(!Number.isInteger(req.body.version))throw fail(400,'The draft version is required. Refresh and try again.');
  res.json(await write(req,'edit',validateContent({...existing,title:req.body.title,content:req.body.content})));
 }));
 router.post('/:id/actions',handler(async(req,res)=>{
  const {action,version,note=''}=req.body;
  if(!['submit','request_changes','approve','publish','revise'].includes(action)||!Number.isInteger(version))throw fail(400,'A valid action and current version are required.');
  if(typeof note!=='string'||note.length>3000||(action==='request_changes'&&!note.trim()))throw fail(400,'Explain the requested changes in a note of up to 3,000 characters.');
  if((['submit','revise'].includes(action)?'admin':'super')!==req.user.role)throw fail(403,'This content action is not available to your role.');
  const current=await result(db.from('curriculum_revisions').select('*').eq('id',req.params.id).maybeSingle());
  if(!current||(req.user.role==='admin'&&current.author_id!==String(req.user.id)))throw fail(404,'Content not available.');
  if(['submit','approve','publish'].includes(action))validateContent(current,true);
  res.json(await write(req,action,{note:note.trim()}));
 }));
 return router;
}
export function createMobileContentRoutes(db){
 const router=express.Router();
 router.get('/',handler(async(req,res)=>{
  if(req.user.role!=='student')throw fail(403,'A student account is required for the mobile feed.');
  const catalog=await result(db.rpc('levelblue_published_catalog'));
  const etag=`"levelblue-content-v1-${catalog.releaseVersion}"`;
  res.set({'Cache-Control':'private, no-cache',ETag:etag,Vary:'Authorization'});
  if(req.headers['if-none-match']===etag)return res.status(304).end();
  res.json(catalog);
 }));return router;
}
