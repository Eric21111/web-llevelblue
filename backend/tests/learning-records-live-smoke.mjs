// Opt-in shared-database test. Credentials stay in environment/memory; only fixtures are removed.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import bcrypt from 'bcryptjs';
import {createClient} from '@supabase/supabase-js';
import {supabase} from '../src/config/db.js';
import {allRows,result} from '../src/services/access.js';
assert.equal(process.env.LEVELBLUE_RUN_LIVE_LEARNING_TEST,'1','Explicit live-test opt-in required');
for(const key of ['SMOKE_TEACHER_EMAIL','SMOKE_HEAD_EMAIL','SMOKE_STAFF_PASSWORD']) assert.ok(process.env[key],`${key} required`);
const report={checks:[],cleanup:[],errors:[]},ids=[];
const check=(name,ok)=>{assert.ok(ok,name);report.checks.push(name);console.log('PASS:',name);};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const snapshot=async()=>{
 const out={};
 for(const table of ['students','bkt_records','player_saves','learning_records']){
  const rows=await allRows(supabase.from(table).select('*').order(table==='students'?'id':'student_id'));
  out[table]={count:rows.length,hash:createHash('sha256').update(JSON.stringify(rows.map(canonical).map(JSON.stringify).sort())).digest('hex')};
 }
 return out;
};
const api=async(port,path,token,body)=>{
 const response=await fetch(`http://127.0.0.1:${port}${path}`,{method:body===undefined?'GET':'POST',signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const bytes=Buffer.from(await response.arrayBuffer());
 return {status:response.status,body:response.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes.toString()):bytes.toString(),bytes};
};
const mobile=(path,token,body)=>api(8000,path,token,body);
const web=(path,token,body)=>api(5000,path,token,body);
const before=await snapshot();
try{
 check('Learning-record table is available',!!before.learning_records);
 const login=async(email,role)=>{
  const r=await web('/api/auth/login',null,{email,password:process.env.SMOKE_STAFF_PASSWORD});
  check(`${role} authenticates`,r.status===200&&r.body.user?.role===role&&!!r.body.token);return r.body.token;
 };
 const teacher=await login(process.env.SMOKE_TEACHER_EMAIL,'admin'),head=await login(process.env.SMOKE_HEAD_EMAIL,'super');
 const sections=await web('/api/sections',teacher);
 check('Teacher has a confirmed assigned section',sections.status===200&&sections.body.some(s=>s.gradeLevel));
 const section=sections.body.find(s=>s.gradeLevel);
 const makeLearner=async(assigned)=>{
  const id=randomUUID(),email=`learning-smoke-${randomBytes(8).toString('hex')}@example.com`,password=`Qa!${randomBytes(18).toString('hex')}`;
  ids.push(id);
  await result(supabase.from('students').insert({id,name:'Temporary Learning Verification',first_name:'Temporary',last_name:'Verification',section:assigned?section.name:'Learning verification (temporary)',section_id:assigned?section.id:null,grade_level:assigned?section.gradeLevel:null,email,password:await bcrypt.hash(password,10),status:'Needs Review',requires_password_change:false}));
  const r=await mobile('/api/auth/login',null,{email,password});check('Temporary learner authenticates',r.status===200&&!!r.body.token);
  return {id,token:r.body.token,email,password};
 };
 const learner=await makeLearner(true),other=await makeLearner(false);
 const bank=await mobile('/api/pretest/questions?module_id=mod_01',learner.token);
 check('Current pre-test question bank is available',bank.status===200&&bank.body.questions?.length>0);
 let tick=Date.now()-600000;
 const event=(kind,fields={})=>({event_id:randomUUID(),kind,module_id:'mod_01',occurred_at:new Date(tick+=1000).toISOString(),...fields});
 const attempt=randomUUID(),abandoned=randomUUID();
 const events=[event('pretest',{answers:bank.body.questions.map(q=>({id:q.id,answer:-1}))}),event('posttest',{attempt_id:attempt,instrument:'stage-exam-v1',correct:0,answered:15,total:15}),event('stage',{attempt_id:attempt,stage:1,outcome:'started'}),event('stage',{attempt_id:attempt,stage:1,outcome:'cleared'}),event('stage',{attempt_id:abandoned,stage:2,outcome:'started'}),event('stage',{attempt_id:abandoned,stage:2,outcome:'abandoned'}),event('mastery',{mastery:0.35})];
 const save={credits:0,pvp_tokens:0,unlocked_skills:['phishing'],mastery_matrix:{phishing:0.35},learning_events:events};
 const upload=await mobile('/api/progress/sync',learner.token,save);
 check('Upload acknowledges every event',upload.status===200&&JSON.stringify(upload.body.acknowledged_events)===JSON.stringify(events.map(e=>e.event_id)));
 const rows=()=>result(supabase.from('learning_records').select('*').eq('student_id',learner.id));
 let records=await rows();
 check('All events have server receipt timestamps',records.length===events.length&&records.every(r=>r.received_at));
 const pre=records.find(r=>r.kind==='pretest'),post=records.find(r=>r.kind==='posttest');
 check('Pre-test is server graded with a versioned instrument',pre.data.source==='server-graded'&&pre.data.instrument.startsWith('pretest-')&&pre.data.total===bank.body.questions.length);
 check('Zero post-test scores are retained and instruments remain unpaired',post.data.score===0&&post.data.correct===0&&post.data.total===15&&post.data.comparison_key===null&&pre.data.comparison_key===null);
 const retry=await mobile('/api/progress/sync',learner.token,save);
 check('Identical retries acknowledge without duplicating records',retry.status===200&&(await rows()).length===events.length);
 const conflict=await mobile('/api/progress/sync',learner.token,{...save,learning_events:[event('mastery',{mastery:0.9}),{...events.at(-1),mastery:0.8}]});
 check('Conflicting replay rolls back the entire batch without acknowledgement',conflict.status===503&&!conflict.body.acknowledged_events&&(await rows()).length===events.length);
 check('Incomplete assessment is rejected',(await mobile('/api/progress/sync',learner.token,{...save,learning_events:[{...events[1],event_id:randomUUID(),answered:14}]})).status===422);
 check('Oversized batches are rejected',(await mobile('/api/progress/sync',learner.token,{...save,learning_events:Array.from({length:101},()=>event('mastery',{mastery:0.5}))})).status===422);
 check('Student identity cannot be injected into an event',(await mobile('/api/progress/sync',learner.token,{...save,learning_events:[{...events.at(-1),student_id:other.id}]})).status===422);
 check('Anonymous uploads are denied',(await mobile('/api/progress/sync',null,save)).status===401);
 check('Staff tokens cannot upload student evidence',[401,403].includes((await mobile('/api/progress/sync',teacher,save)).status));
 const cloud=await mobile('/api/progress/sync',learner.token);
 check('Cloud save preserves zero balances and unlocks without restoring the event queue',cloud.status===200&&cloud.body.credits===0&&cloud.body.pvp_tokens===0&&cloud.body.unlocked_skills[0]==='phishing'&&!Object.hasOwn(cloud.body,'learning_events'));
 check('Another learner cannot read this save',(await mobile(`/api/progress/sync?student_id=${learner.id}`,other.token)).body===null);
 const analytics=await web('/api/analytics',teacher);
 const student=analytics.body.students?.find(s=>s._id===learner.id);
 check('Teacher sees assigned evidence with matching mastery',analytics.status===200&&analytics.body.evidence.available&&student?.mastery.Phishing===0.35&&student.evidence.assessments.length===2&&student.evidence.observations[0].data.mastery===0.35);
 check('Clearance excludes abandoned attempts and unmatched gains remain unavailable',student.evidence.started===2&&student.evidence.finished===1&&student.evidence.cleared===1&&student.evidence.incomplete===1&&student.evidence.clearanceRate===1&&student.evidence.pairs.length===0);
 check('Teacher cannot see unassigned learners',!analytics.body.students.some(s=>s._id===other.id));
 const school=await web('/api/analytics',head);
 check('School head can see both temporary learners',school.status===200&&ids.every(id=>school.body.students.some(s=>s._id===id)));
 const risk=await web('/api/analytics/at-risk',teacher);
 check('Risk flags agree with recorded mastery',risk.status===200&&risk.body.find(s=>s._id===learner.id)?.failedTopics.includes('Phishing'));
 for(const format of ['csv','pdf']){
  const exported=await web(`/api/reports/individual?studentId=${learner.id}&format=${format}`,teacher);
  check(`Authorized individual ${format.toUpperCase()} export includes evidence`,exported.status===200&&(format==='pdf'?exported.bytes.subarray(0,5).toString()==='%PDF-':exported.body.includes('stage-exam-v1')&&exported.body.includes('"0","15","0"')&&exported.body.includes('"0.35"')));
  const institutional=await web(`/api/reports/institutional?sectionId=${section.id}&format=${format}`,head);
  check(`Head institutional ${format.toUpperCase()} export succeeds`,institutional.status===200&&(format==='pdf'?institutional.bytes.subarray(0,5).toString()==='%PDF-':institutional.body.includes(learner.id)&&!institutional.body.includes(other.id)));
 }
 check('Teacher cannot export an unassigned learner',(await web(`/api/reports/individual?studentId=${other.id}&format=csv`,teacher)).status===404);
 check('Teacher cannot export institutional reports',(await web('/api/reports/institutional?format=csv',teacher)).status===403);
 check('Student cannot export staff reports',[401,403].includes((await web(`/api/reports/individual?studentId=${learner.id}`,learner.token)).status));
 // The live student status constraint has no Inactive state; rejection of inactive
 // students is covered in the mobile unit suite, not fabricated in this database.
 const anon=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 check('Anonymous database reads are denied',!!(await anon.from('learning_records').select('id').limit(1)).error);
 check('Anonymous ingestion RPC execution is denied',!!(await anon.rpc('levelblue_record_learning',{p_student:learner.id,p_events:[]})).error);
}catch(error){report.errors.push(error.message||error.code||'Unknown test failure');console.error('FAIL:',report.errors.at(-1));process.exitCode=1;}
finally{
 for(const id of ids) for(const [table,column] of [['learning_records','student_id'],['player_saves','student_id'],['bkt_records','student_id'],['students','id']]){
  try{await result(supabase.from(table).delete().eq(column,id));report.cleanup.push(`${table}: removed temporary record(s)`);}catch(error){report.errors.push(`Cleanup failed for ${table}: ${error.code||'unknown'}`);process.exitCode=1;}
 }
 try{const after=await snapshot();for(const table of Object.keys(before))check(`Existing ${table} records are unchanged`,after[table].hash===before[table].hash&&after[table].count===before[table].count);}catch(error){report.errors.push(error.message);process.exitCode=1;}
 report.completedAt=new Date().toISOString();report.passed=!process.exitCode;
 writeFileSync(new URL('../../docs/learning-records-live-test-results.json',import.meta.url),JSON.stringify(report,null,2));
 console.log('LEARNING_SMOKE_COMPLETE',JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));
}
