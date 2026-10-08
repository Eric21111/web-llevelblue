// Opt-in live integration check. Temporary accounts only; no existing learner is used.
import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import bcrypt from 'bcryptjs';
import {createClient} from '@supabase/supabase-js';
import {supabase} from '../src/config/db.js';
import {allRows,result} from '../src/services/access.js';
assert.equal(process.env.LEVELBLUE_RUN_LIVE_SAVE_TEST,'1','Live tests require explicit opt-in');
const report={checks:[],cleanup:[],errors:[]},ids=[];
const check=(name,ok)=>{assert.ok(ok,name);report.checks.push(name);console.log('PASS:',name);};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const snapshot=async()=>{
 const out={};
 for(const table of ['students','bkt_records','player_saves']){
  const rows=await allRows(supabase.from(table).select('*').order(table==='students'?'id':'student_id'));
  // Hash in memory; never write row contents or password hashes to the report.
  const normalized=rows.map(canonical).map(JSON.stringify).sort();
  out[table]={count:rows.length,hash:createHash('sha256').update(JSON.stringify(normalized)).digest('hex')};
 }
 return out;
};
const api=async(path,token,body)=>{
 const response=await fetch(`http://127.0.0.1:8000${path}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {status:response.status,body:await response.json()};
};
const before=await snapshot();
let temporaryCredentials;
try{
 check('player_saves is available through the database API',!!before.player_saves);
 const makeLearner=async()=>{
  const id=randomUUID(),email=`save-smoke-${randomBytes(8).toString('hex')}@example.com`,password=`Qa!${randomBytes(18).toString('hex')}`;
  ids.push(id);
  await result(supabase.from('students').insert({id,name:'Temporary Save Verification',first_name:'Temporary',last_name:'Verification',section:'Save verification (temporary)',email,password:await bcrypt.hash(password,10),status:'Needs Review',requires_password_change:false}));
  const response=await api('/api/auth/login',null,{email,password});
  check('Temporary learner authenticates through the mobile API',response.status===200&&!!response.body.token);
  return {id,token:response.body.token,email,password};
 };
 const learner=await makeLearner();temporaryCredentials={email:learner.email,password:learner.password};
 const other=await makeLearner();
 check('A fresh learner has no cloud save',(await api('/api/progress/sync',learner.token)).body===null);
 check('Anonymous save reads are denied',(await api('/api/progress/sync')).status===401);
 check('Anonymous save writes are denied',(await api('/api/progress/sync',null,{})).status===401);
 const first={mock_max_stage_cleared:3,mastery_matrix:{phishing:0.25,smishing:0.6},credits:0,unlocked_towers:['base'],unlocked_skills:['phishing'],completed_lessons:['ports_basics'],lesson_progress:{mod_01:1},purchased_items:[],locked_stages:{mod_01:[4,5]},module_pretests:{mod_01:true},pvp_tokens:0,student:{points:0,sessions:1,pre:0,post:0}};
 let saved=await api('/api/progress/sync',learner.token,first);
 check('First progress upload succeeds',saved.status===200&&saved.body.ok===true);
 let loaded=await api('/api/progress/sync',learner.token);
 check('Saved progress reads back successfully',loaded.status===200&&loaded.body.mock_max_stage_cleared===3);
 check('Zero currency values and unlocked entries survive the round trip',loaded.body.credits===0&&loaded.body.pvp_tokens===0&&JSON.stringify(loaded.body.unlocked_skills)===JSON.stringify(first.unlocked_skills));
 check('Pre-test flags and extra save fields are preserved',loaded.body.module_pretests.mod_01===true&&loaded.body.completed_lessons[0]==='ports_basics');
 const second={...first,credits:40,mastery_matrix:{phishing:0.35,smishing:0.65},lesson_progress:{mod_01:2}};
 delete second.module_pretests;
 saved=await api('/api/progress/sync',learner.token,second);
 check('A second upload updates the same student save',saved.status===200&&saved.body.ok===true);
 loaded=await api('/api/progress/sync',learner.token);
 check('Latest values are returned and omitted pre-test flags are retained',loaded.body.credits===40&&loaded.body.lesson_progress.mod_01===2&&loaded.body.module_pretests.mod_01===true);
 const rows=await result(supabase.from('player_saves').select('student_id,payload,updated_at').eq('student_id',learner.id));
 check('Exactly one timestamped save exists for the learner',rows.length===1&&!!rows[0].updated_at);
 const bkt=await result(supabase.from('bkt_records').select('topic,probability_known').eq('student_id',learner.id));
 check('Mastery updates do not duplicate BKT topic rows',bkt.length===2&&bkt.find(r=>r.topic==='Phishing')?.probability_known===0.35);
 const student=await result(supabase.from('students').select('mastery_phishing,mastery_smishing,highest_unlocked_stage,pre,post').eq('id',learner.id).single());
 check('Student mastery and stage reflect the saved snapshot',student.mastery_phishing===0.35&&student.mastery_smishing===0.65&&student.highest_unlocked_stage===3&&student.pre===0&&student.post===0);
 const freshLogin=await api('/api/auth/login',null,temporaryCredentials);
 const restored=await api('/api/progress/sync',freshLogin.body.token);
 check('A new login retrieves the same cloud save',freshLogin.status===200&&JSON.stringify(canonical(restored.body))===JSON.stringify(canonical(loaded.body)));
 const isolated=await api(`/api/progress/sync?student_id=${learner.id}`,other.token);
 check('Another learner cannot read the save by changing a query parameter',isolated.status===200&&isolated.body===null);
 const anon=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const publicRead=await anon.from('player_saves').select('student_id').limit(1);
 check('Direct anonymous database access is denied',!!publicRead.error);
}catch(error){report.errors.push(error.message);console.error('FAIL:',error.message);process.exitCode=1;}
finally{
 temporaryCredentials=null;
 for(const id of ids){
  for(const [table,column] of [['player_saves','student_id'],['bkt_records','student_id'],['students','id']]){
   try{await result(supabase.from(table).delete().eq(column,id));report.cleanup.push(`${table}: removed temporary record(s)`);}catch(error){report.errors.push(`Cleanup failed for ${table}: ${error.code||'unknown'}`);process.exitCode=1;}
  }
 }
 try{
  const after=await snapshot();
  for(const table of Object.keys(before))check(`Existing ${table} records are unchanged`,after[table].hash===before[table].hash&&after[table].count===before[table].count);
 }catch(error){report.errors.push(error.message);process.exitCode=1;}
 report.completedAt=new Date().toISOString();report.passed=!process.exitCode;
 writeFileSync(new URL('../../docs/player-saves-live-test-results.json',import.meta.url),JSON.stringify(report,null,2));
 console.log('SAVE_SMOKE_COMPLETE',JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));
}
