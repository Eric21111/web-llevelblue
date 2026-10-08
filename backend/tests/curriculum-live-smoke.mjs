// Explicit opt-in smoke runner for the live local APIs. Creates one temporary
// learner, waits for the browser's test publication, then removes only its fixtures.
// Credentials come from process environment and are never saved in the report.
import 'dotenv/config';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {supabase} from '../src/config/db.js';
const state=JSON.parse(readFileSync('.curriculum-smoke-state.log','utf8'));
assert.equal(state.marker,'Curriculum verification 20261008-01');
assert.ok(state.item&&state.revision&&process.env.SMOKE_STAFF_PASSWORD);
const report={checks:[],cleanup:[],limitations:[]};
const check=(name,value)=>{assert.ok(value,name);report.checks.push(name);console.log('PASS:',name);};
const unwrap=async query=>{const {data,error}=await query;if(error)throw new Error(`Database request failed (${error.code})`);return data;};
const call=async(port,path,token,body,method=body?'POST':'GET')=>{
 const res=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:res.status,headers:res.headers,body:res.status===304?null:await res.json()};
};
let learnerId;
try{
 // Capture immediately before this run, not before an interactive pause.
 state.before={};
 for(const [table,columns] of [['students','id,grade_level,section_id,pre,post,mastery_phishing,mastery_smishing,mastery_vishing,mastery_pretexting,mastery_baiting'],['bkt_records','*'],['player_saves','*']]){
  const {data,error}=await supabase.from(table).select(columns);
  if(error){state.before[table]={unavailable:error.code};continue;}
  state.before[table]={count:data.length,hash:createHash('sha256').update(JSON.stringify(data.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex')};
 }
 writeFileSync('.curriculum-smoke-state.log',JSON.stringify(state));
 let owned=await unwrap(supabase.from('curriculum_revisions').select('item_id,title').eq('id',state.revision).maybeSingle());
 if(!owned){
  const session=await call(5000,'/api/auth/login',null,{email:process.env.SMOKE_TEACHER_EMAIL,password:process.env.SMOKE_STAFF_PASSWORD});
  assert.equal(session.status,200,'Fixture teacher login');
  const created=await call(5000,'/api/curriculum',session.body.token,{title:state.marker,topic:'Phishing',kind:'lesson',content:{body:'Temporary verification lesson. If a message asks for your school password, do not reply. Verify the request through a trusted school channel.',objectives:['Verify unexpected requests through a trusted school channel.']}});
  assert.equal(created.status,201,'Fixture draft creation');
  state.item=created.body.item_id;state.revision=created.body.id;delete state.learner;
  writeFileSync('.curriculum-smoke-state.log',JSON.stringify(state));
  const submitted=await call(5000,`/api/curriculum/${state.revision}/actions`,session.body.token,{action:'submit',version:created.body.version});
  assert.equal(submitted.status,200,'Fixture submission');owned=created.body;
 }
 assert.equal(owned.item_id,state.item);assert.equal(owned.title,state.marker);
 const email=`curriculum-smoke-${randomBytes(8).toString('hex')}@example.com`, password=`Qa!${randomBytes(18).toString('hex')}`;
 const learner=await unwrap(supabase.from('students').insert({name:'Temporary Curriculum Verification',first_name:'Temporary',last_name:'Verification',section:'Curriculum verification (temporary)',email,password:await bcrypt.hash(password,10),requires_password_change:false,status:'Needs Review'}).select('id').single());
 learnerId=learner.id;state.learner=learnerId;writeFileSync('.curriculum-smoke-state.log',JSON.stringify(state));
 const login=await call(8000,'/api/auth/login',null,{email,password});
 check('Temporary learner signs in through the real mobile API',login.status===200&&!!login.body.token);
 const token=login.body.token;
 const hidden=await call(8000,'/api/content',token);
 check('Submitted/approved lesson is hidden from students',hidden.status===200&&!hidden.body.items.some(i=>i.id===state.item));
 check('Anonymous mobile content request is denied',(await call(8000,'/api/content')).status===401);
 const teacher=await call(5000,'/api/auth/login',null,{email:process.env.SMOKE_TEACHER_EMAIL,password:process.env.SMOKE_STAFF_PASSWORD});
 check('Teacher API sign-in succeeds',teacher.status===200&&teacher.body.user.role==='admin');
 const teacherToken=teacher.body.token;
 check('Teacher cannot publish',(await call(5000,`/api/curriculum/${state.revision}/actions`,teacherToken,{action:'publish',version:1})).status===403);
 check('Student cannot author staff content',[401,403].includes((await call(5000,'/api/curriculum',token,{})).status));
 if(process.env.SMOKE_AUTO_REVIEW==='1'){
  const head=await call(5000,'/api/auth/login',null,{email:process.env.SMOKE_HEAD_EMAIL,password:process.env.SMOKE_STAFF_PASSWORD});
  check('School-head API sign-in succeeds',head.status===200&&head.body.user.role==='super');
  const list=await call(5000,'/api/curriculum',head.body.token);
  const submitted=list.body.find(row=>row.id===state.revision);
  const approved=await call(5000,`/api/curriculum/${state.revision}/actions`,head.body.token,{action:'approve',version:submitted.version});
  check('School head approves the submitted revision',approved.status===200&&approved.body.status==='approved');
  const approvedFeed=await call(8000,'/api/content',token);
  check('Approval alone does not publish content',!approvedFeed.body.items.some(item=>item.id===state.item));
  const publication=await call(5000,`/api/curriculum/${state.revision}/actions`,head.body.token,{action:'publish',version:approved.body.version});
  check('School head publishes the approved revision',publication.status===200&&publication.body.status==='published');
 }
 console.log('READY_FOR_BROWSER_PUBLICATION');
 const deadline=Date.now()+1800000;
 let published;
 while(Date.now()<deadline){
  const result=await call(8000,'/api/content',token);
  if(result.status===200&&result.body.items.some(i=>i.id===state.item)){published=result;break;}
  await new Promise(resolve=>setTimeout(resolve,1500));
 }
 assert.ok(published,'Browser publication was not received within thirty minutes');
 const item=published.body.items.find(i=>i.id===state.item);
 check('Published lesson reaches the real mobile API',item.title===state.marker&&item.revision===1);
 check('Private author and review fields are omitted',!('author_id' in item)&&!('review_note' in item));
 const conditional=await fetch('http://127.0.0.1:8000/api/content',{headers:{Authorization:`Bearer ${token}`,'If-None-Match':published.headers.get('etag')}});
 check('Unchanged catalog returns HTTP 304',conditional.status===304);
 const {stdout,stderr}=await promisify(execFile)(process.env.SMOKE_GODOT,[
  '--headless','--path',process.env.SMOKE_MOBILE_FRONTEND,'--script',fileURLToPath(new URL('./curriculum-mobile-smoke.gd',import.meta.url))
 ],{env:{...process.env,LEVELBLUE_SMOKE_TOKEN:token,LEVELBLUE_SMOKE_ITEM:state.item},windowsHide:true,timeout:45000,maxBuffer:1024*1024});
 check('Godot fetches and renders the published lesson without changing progress',stdout.includes('LIVE_CURRICULUM_MOBILE:')&&stdout.includes('failures=0')&&!stderr.includes('SCRIPT ERROR'));
 const revisions=await call(5000,'/api/curriculum',teacherToken);
 const current=revisions.body.find(r=>r.id===state.revision);
 const stale=await call(5000,`/api/curriculum/${state.revision}/actions`,teacherToken,{action:'revise',version:current.version-1});
 check('Stale revision actions are rejected',stale.status===409);
 const revised=await call(5000,`/api/curriculum/${state.revision}/actions`,teacherToken,{action:'revise',version:current.version});
 check('Published content can only be revised as a new draft',revised.status===200&&revised.body.revision===2&&revised.body.status==='draft');
 const stillPublished=await call(8000,'/api/content',token);
 check('Creating a new draft keeps the previous publication live',stillPublished.body.items.find(i=>i.id===state.item).revision===1);
 const history=await call(5000,`/api/curriculum/${state.revision}/history`,teacherToken);
 check('History records author and school-head actions',history.body.some(e=>e.action==='create')&&history.body.some(e=>e.action==='approve')&&history.body.some(e=>e.action==='publish')&&history.body.every(e=>e.actor_id&&e.created_at));
}catch(error){report.error=error.message;console.error('SMOKE FAILED:',error.message);process.exitCode=1;}
finally{
 for(const [table,column,id] of [['curriculum_events','item_id',state.item],['curriculum_revisions','item_id',state.item],['curriculum_items','id',state.item],['students','id',learnerId]]){
  if(!id)continue;
  try{await unwrap(supabase.from(table).delete().eq(column,id));report.cleanup.push(table);}catch(error){report.cleanup.push(`${table}: FAILED`);console.error('Cleanup failed:',table,error.message);process.exitCode=1;}
 }
 for(const [table,columns] of [['students','id,grade_level,section_id,pre,post,mastery_phishing,mastery_smishing,mastery_vishing,mastery_pretexting,mastery_baiting'],['bkt_records','*'],['player_saves','*']]){
  try{
   const {data,error}=await supabase.from(table).select(columns);
   if(error){assert.equal(error.code,state.before[table].unavailable);report.limitations.push(`${table} unavailable: ${error.code}`);continue;}
   const hash=createHash('sha256').update(JSON.stringify(data.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))).digest('hex');
   check(`Existing ${table} records unchanged`,hash===state.before[table].hash&&data.length===state.before[table].count);
  }catch(error){report.error=error.message;console.error('Preservation check failed:',table);process.exitCode=1;}
 }
 const catalog=await supabase.rpc('levelblue_published_catalog');
 check('Temporary lesson removed from publication',!catalog.error&&!catalog.data.items.some(i=>i.id===state.item));
 report.completedAt=new Date().toISOString();writeFileSync('../docs/curriculum-live-test-results.json',JSON.stringify(report,null,2));
 console.log('SMOKE_COMPLETE',JSON.stringify({checks:report.checks.length,cleanup:report.cleanup,limitations:report.limitations,passed:!process.exitCode}));
}
