// Explicit opt-in. Uses isolated temporary sections/learners; no real enrollment is changed.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import bcrypt from 'bcryptjs';
import {createClient} from '@supabase/supabase-js';
import {supabase} from '../src/config/db.js';
import {allRows,result} from '../src/services/access.js';
assert.equal(process.env.LEVELBLUE_RUN_LIVE_ENROLLMENT_TEST,'1','Explicit live-test opt-in required');
for(const name of ['SMOKE_HEAD_EMAIL','SMOKE_TEACHER_EMAIL','SMOKE_STAFF_PASSWORD'])assert.ok(process.env[name],`${name} required`);
const report={checks:[],cleanup:[],errors:[]},students=[],sections=[],batches=[],bounties=[],interventions=[];
const auditIds=new Set();
const check=(label,condition)=>{assert.ok(condition,label);report.checks.push(label);console.log('PASS:',label);};
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex');
const tables={students:'id',sections:'id',teacher_sections:'teacher_id',bkt_records:'student_id',player_saves:'student_id',learning_records:'id',feedback:'id',learning_interventions:'id',support_bounties:'id',enrollment_history:'id',enrollment_batches:'id',staff_events:'id'};
async function snapshot(){const out={};for(const [table,column] of Object.entries(tables)){const rows=await allRows(supabase.from(table).select('*').order(column).order(table==='teacher_sections'?'section_id':column));out[table]={count:rows.length,hash:hash(rows.map(canonical).map(JSON.stringify).sort())};}return out;}
async function api(port,path,token,body,method=body===undefined?'GET':'POST'){
 const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,signal:AbortSignal.timeout(30000),headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const bytes=Buffer.from(await r.arrayBuffer());return {status:r.status,bytes,body:r.headers.get('content-type')?.includes('application/json')?JSON.parse(bytes.toString()):bytes.toString()};
}
const web=(path,token,body,method)=>api(5000,path,token,body,method);
const mobile=(path,token,body)=>api(8000,path,token,body);
const before=await snapshot();
try{
 // Confirm cleanup privileges before creating any history, without matching existing rows.
 for(const table of ['enrollment_history','enrollment_batches'])await result(supabase.from(table).delete().eq('id',randomUUID()));
 check('Enrollment tables and cleanup privileges are available',true);
 const staffLogin=async(email,role)=>{const r=await web('/api/auth/login',null,{email,password:process.env.SMOKE_STAFF_PASSWORD});check(`${role} login works`,r.status===200&&r.body.user?.role===role);return {token:r.body.token,id:String(r.body.user._id??r.body.user.id)};};
 const teacher=await staffLogin(process.env.SMOKE_TEACHER_EMAIL,'admin'),head=await staffLogin(process.env.SMOKE_HEAD_EMAIL,'super');
 check('Migrated checklist loads',(await web('/api/enrollment',head.token)).status===200);
 const makeSection=async(token,grade)=>{
  const name=`Enrollment verification ${randomBytes(6).toString('hex')}`;
  const r=await web('/api/sections',token,{name,gradeLevel:grade});
  assert.equal(r.status,201,'Temporary section creation');sections.push(r.body.id);auditIds.add(r.body.id);return r.body;
 };
 const source=await makeSection(teacher.token,'Grade 11'),target=await makeSection(teacher.token,'Grade 12'),foreign=await makeSection(head.token,'Grade 12');
 check('Teacher creates automatically assigned source and destination sections',(await web('/api/sections',teacher.token)).body.filter(s=>[source.id,target.id].includes(s.id)).length===2);
 const learner=async(name)=>{
  const id=randomUUID(),email=`enrollment-smoke-${randomBytes(8).toString('hex')}@example.com`,password=`Qa!${randomBytes(18).toString('hex')}`;students.push(id);
  await result(supabase.from('students').insert({id,name,first_name:'Temporary',last_name:'Verification',email,password:await bcrypt.hash(password,10),section:source.name,section_id:source.id,grade_level:'Grade 11',requires_password_change:false,status:'Needs Review'}));
  const r=await mobile('/api/auth/login',null,{email,password});assert.equal(r.status,200,'Temporary learner login');return {id,email,password,token:r.body.token};
 };
 const student=await learner('Temporary Enrollment Verification'),mentor=await learner('Temporary Mentor Verification');
 const time=new Date(Date.now()-60000).toISOString(),attempt=randomUUID();
 const details={phase:'Trace',health:0,answered:3,correct:0,waves_completed:0,waves_total:3,timed_out:true,missed_question_ids:['fixture-question-1']};
 const events=[{event_id:randomUUID(),kind:'mastery',module_id:'mod_01',occurred_at:time,mastery:0.35},{event_id:randomUUID(),kind:'stage',module_id:'mod_01',occurred_at:time,attempt_id:attempt,stage:1,outcome:'failed',details}];
 const save={mock_max_stage_cleared:3,credits:0,pvp_tokens:0,unlocked_skills:['phishing'],unlocked_towers:['base'],codex_unlocks:['phishing-entry'],module_pretests:{mod_01:true},mastery_matrix:{phishing:0.35},learning_events:events};
 const synced=await mobile('/api/progress/sync',student.token,save);
 check('Mobile API accepts detailed stage evidence',synced.status===200&&synced.body.acknowledged_events.length===2);
 check('Mentor mastery fixture uploads',(await mobile('/api/progress/sync',mentor.token,{mastery_matrix:{phishing:0.95}})).status===200);
 const record=await result(supabase.from('learning_records').select('*').eq('student_id',student.id).eq('kind','stage').single());
 check('Failed-stage details preserve zero scores and question references',record.data.details.correct===0&&record.data.details.health===0&&record.data.details.missed_question_ids[0]==='fixture-question-1');
 // The independently configured APIs issue their own sessions. Authenticate with
 // Express for its student endpoints rather than assuming shared JWT secrets.
 const studentWebLogin=await web('/api/auth/login',null,{email:student.email,password:student.password});
 check('Student can authenticate for web feedback endpoints',studentWebLogin.status===200&&studentWebLogin.body.user?.role==='student');
 const studentWebToken=studentWebLogin.body.token;
 const feedback=await web('/api/usability-feedback',studentWebToken,{q1:4,q2:4,q3:2,q4:4,q5:5,module:'Phishing',feedbackType:'comment',comments:'Temporary enrollment verification'});
 check('Student feedback fixture records original enrollment',feedback.status===201);
 const review=await web('/api/interventions',teacher.token,{studentId:student.id,kind:'review',topic:'Phishing',note:'Temporary enrollment verification',outcome:'Pending'});
 assert.equal(review.status,201);interventions.push(review.body.id);auditIds.add(review.body.id);
 const oversight=await web(`/api/teacher-activity?sectionId=${source.id}&days=7`,head.token);
 check('Head sees documented teacher review activity',oversight.status===200&&oversight.body.teachers.some(t=>String(t.id)===teacher.id&&t.reviews===1));
 check('Teacher cannot access school-head oversight',(await web('/api/teacher-activity',teacher.token)).status===403);
 const bounty=await web('/api/bounties',teacher.token,{mentor_id:mentor.id,mentee_id:student.id,topics:['Phishing']});
 assert.equal(bounty.status,201,'Temporary bounty creation');for(const b of bounty.body){bounties.push(b.id);auditIds.add(String(b.id));}
 const request=(patch={})=>{const requestId=randomUUID();batches.push(requestId);auditIds.add(requestId);return {requestId,action:'promote',sourceId:source.id,targetId:target.id,fromYear:'2026-2027',toYear:'2027-2028',students:[{id:student.id,version:0}],...patch};};
 const promotion=request();
 check('Active mentor bounty blocks promotion',(await web('/api/enrollment',teacher.token,promotion)).status===409);
 check('Blocked promotion leaves no partial history',(await result(supabase.from('enrollment_history').select('id').eq('student_id',student.id))).length===0);
 check('Teachers cannot choose an unassigned destination',(await web('/api/enrollment',teacher.token,request({targetId:foreign.id}))).status===403);
 check('Teachers cannot query foreign enrollment',(await web(`/api/enrollment?sectionId=${foreign.id}`,teacher.token)).status===403);
 check('Authenticated students cannot promote themselves',(await web('/api/enrollment',studentWebToken,promotion)).status===403);
 check('Anonymous enrollment requests are denied',(await web('/api/enrollment',null,promotion)).status===401);
 check('Teacher can cancel the outstanding bounty',(await web(`/api/bounties/${bounties[0]}`,teacher.token,undefined,'DELETE')).status===200);
 const preserved=async()=>({student:await result(supabase.from('students').select('id,pre,post,mastery_phishing,highest_unlocked_stage,points').eq('id',student.id).single()),bkt:await result(supabase.from('bkt_records').select('*').eq('student_id',student.id)),save:await result(supabase.from('player_saves').select('*').eq('student_id',student.id)),records:await result(supabase.from('learning_records').select('*').eq('student_id',student.id).order('id')),feedback:await result(supabase.from('feedback').select('*').eq('student_id',student.id)),reviews:await result(supabase.from('learning_interventions').select('*').eq('student_id',student.id))});
 const learningBefore=await preserved();
 const moved=await web('/api/enrollment',teacher.token,promotion);
 check('Teacher promotion succeeds after bounty resolution',moved.status===200&&moved.body.count===1);
 const row=()=>result(supabase.from('students').select('id,section,section_id,grade_level,enrollment_status,enrollment_version,academic_year').eq('id',student.id).single());
 let current=await row();
 check('Promotion updates grade, section and academic year on the same account',current.id===student.id&&current.section===target.name&&current.section_id===target.id&&current.grade_level==='Grade 12'&&current.academic_year==='2027-2028'&&current.enrollment_version===1);
 check('Promotion preserves all learning, saves, unlocks, feedback and reviews',hash(await preserved())===hash(learningBefore));
 const replay=await web('/api/enrollment',teacher.token,promotion);
 check('A retried checklist does not duplicate promotion',replay.status===200&&replay.body.replayed&&(await row()).enrollment_version===1);
 check('Stale student versions are rejected',(await web('/api/enrollment',teacher.token,request())).status===409);
 const stale=await mobile('/api/progress/sync',student.token,{...save,student:{section:source.name,section_id:source.id,grade_level:'Grade 11',academic_year:'2026-2027',enrollment_status:'active',enrollment_version:0}});
 check('An old mobile snapshot still syncs learning data',stale.status===200);
 current=await row();check('An old snapshot cannot overwrite promoted enrollment',current.section_id===target.id&&current.grade_level==='Grade 12'&&current.enrollment_version===1);
 const dbStale=await supabase.from('students').update({section:source.name,section_id:source.id,grade_level:'Grade 11'}).eq('id',student.id);
 check('Database guard rejects enrollment writes outside the checklist',!!dbStale.error&&(await row()).section_id===target.id);
 const cloud=await mobile('/api/progress/sync',student.token);
 check('Restored cloud save retains zero values, stage progress and unlocks',cloud.status===200&&cloud.body.credits===0&&cloud.body.mock_max_stage_cleared===3&&cloud.body.unlocked_skills[0]==='phishing'&&cloud.body.codex_unlocks[0]==='phishing-entry');
 check('Learning-event retries remain duplicate-free after promotion',(await result(supabase.from('learning_records').select('id').eq('student_id',student.id))).length===2);
 const analytics=await web(`/api/analytics?sectionId=${target.id}`,teacher.token);
 check('Destination diagnostics show the same learner and mastery',analytics.status===200&&analytics.body.students.find(s=>s._id===student.id)?.mastery.Phishing===0.35);
 const beforeGraduation=await preserved();
 const graduation=request({action:'graduate',sourceId:target.id,targetId:null,fromYear:'2027-2028',toYear:null,students:[{id:student.id,version:1}]});
 const graduated=await web('/api/enrollment',head.token,graduation);
 check('School head can graduate Grade 12 enrollment',graduated.status===200&&(await row()).enrollment_status==='graduated');
 check('Graduation preserves the account and every existing learning record',hash(await preserved())===hash(beforeGraduation));
 const active=await web(`/api/students?sectionId=${target.id}`,teacher.token),archived=await web(`/api/students?sectionId=${target.id}&enrollment=graduated`,teacher.token);
 check('Graduated learners leave active rosters but remain in authorized archives',active.status===200&&!active.body.some(s=>s._id===student.id)&&archived.status===200&&archived.body.some(s=>s._id===student.id));
 const history=await web('/api/enrollment',teacher.token);
 check('Enrollment history contains both actor-stamped transitions',history.status===200&&history.body.history.filter(h=>h.student_id===student.id).length===2&&history.body.history.filter(h=>h.student_id===student.id).every(h=>h.actor_id&&h.created_at));
 for(const format of ['csv','pdf']){
  const exported=await web(`/api/reports/individual?studentId=${student.id}&enrollment=graduated&format=${format}`,teacher.token);
  check(`Archived ${format.toUpperCase()} report remains available with recorded evidence`,exported.status===200&&(format==='pdf'?exported.bytes.subarray(0,5).toString()==='%PDF-':exported.body.includes('fixture-question-1')&&exported.body.includes('graduated')));
 }
 const loginAgain=await mobile('/api/auth/login',null,{email:student.email,password:student.password});
 check('Graduation preserves mobile account access',loginAgain.status===200&&!!loginAgain.body.token);
 check('An existing token can sync without restoring active enrollment',(await mobile('/api/progress/sync',student.token,save)).status===200&&(await row()).enrollment_status==='graduated');
 const anon=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 check('Anonymous enrollment-history access is denied',!!(await anon.from('enrollment_history').select('id').limit(1)).error);
 check('Anonymous transition RPC execution is denied',!!(await anon.rpc('levelblue_transition_enrollment',{p_actor:head.id,p_batch:randomUUID(),p_request:{}})).error);
}catch(error){report.errors.push(error.message||error.code||'Unknown failure');console.error('FAIL:',report.errors.at(-1));process.exitCode=1;}
finally{
 const remove=async(table,column,values)=>{if(!values.length)return;try{await result(supabase.from(table).delete().in(column,values));report.cleanup.push(`${table}: temporary rows removed`);}catch(error){report.errors.push(`Cleanup ${table}: ${error.code||'unknown'}`);process.exitCode=1;}};
 await remove('enrollment_history','batch_id',batches);await remove('enrollment_batches','id',batches);
 await remove('support_bounties','id',bounties);await remove('learning_interventions','id',interventions);
 for(const table of ['learning_records','feedback','bkt_records','player_saves'])await remove(table,'student_id',students);
 await remove('students','id',students);await remove('teacher_sections','section_id',sections);await remove('sections','scope_id',sections);await remove('staff_events','entity_id',[...auditIds]);
 try{const after=await snapshot();for(const t of Object.keys(before))check(`Existing ${t} rows are unchanged`,before[t].count===after[t].count&&before[t].hash===after[t].hash);}catch(e){report.errors.push(e.message||e.code);process.exitCode=1;}
 report.completedAt=new Date().toISOString();report.passed=!process.exitCode;
 writeFileSync(new URL('../../docs/enrollment-live-test-results.json',import.meta.url),JSON.stringify(report,null,2));
 console.log('ENROLLMENT_SMOKE_COMPLETE',JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));
}
