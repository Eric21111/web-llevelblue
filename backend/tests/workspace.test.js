import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import {fakeDb,seed} from './helpers.js';
import {createWorkspaceRoutes} from '../src/routes/workspaceRoutes.js';
import {createBountyRoutes} from '../src/routes/scopedBounties.js';
import {createFeedbackHandlers} from '../src/services/feedbackService.js';
import {mapLearner,recordedMastery,topicSummary} from '../src/services/learning.js';
import {csvCell,reportRows} from '../src/services/reports.js';
import {allRows} from '../src/services/access.js';
process.env.SUPABASE_URL='https://example.supabase.co';process.env.SUPABASE_ANON_KEY='test';process.env.SUPABASE_SERVICE_KEY='test';
const {createAuthMiddleware}=await import('../src/middleware/auth.js');
function app(user={id:'teacher',role:'admin',status:'Active'},db=fakeDb(seed)) {
 const a=express();a.use(express.json());a.use((req,res,next)=>{req.user=user;next();});
 a.use('/api/bounties',createBountyRoutes(db));a.get('/api/feedback',createFeedbackHandlers(db).getFeedback);a.use('/api',createWorkspaceRoutes(db));
 a.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));return a;
}
test('teacher and co-teacher see only their assigned roster; foreign filters and IDs fail closed',async()=>{
 for(const id of ['teacher','co-teacher']){
  const a=app({id,role:'admin',status:'Active'});
  assert.deepEqual((await request(a).get('/api/students').expect(200)).body.map(s=>s._id),['s1','mentor']);
  await request(a).get('/api/students?sectionId=b').expect(403);
  await request(a).get('/api/students/s2/mentors').expect(404);
  await request(a).get('/api/reports/individual?studentId=s2&format=csv').expect(404);
  await request(a).get('/api/interventions?studentId=s2').expect(404);
  await request(a).post('/api/interventions').send({studentId:'s2'}).expect(404);
  await request(a).get('/api/feedback?sectionId=b').expect(403);
 }
});
test('students and inactive/invited staff cannot access staff routes',async()=>{
 for(const user of [{id:'s1',role:'student'},{id:'teacher',role:'admin',status:'Inactive'},{id:'teacher',role:'admin',status:'Invited'}]){
  for(const path of ['/students','/teachers','/sections','/analytics','/interventions','/reports/institutional']) await request(app(user)).get('/api'+path).expect(403);
 }
 await request(app()).get('/api/teachers').expect(403);
 await request(app()).patch('/api/teachers/other').send({status:'Inactive',sectionIds:[]}).expect(403);
 await request(app()).get('/api/reports/institutional').expect(403);
});
test('unassigned teachers get empty results and invalid grade filters fail',async()=>{
 const a=app({id:'unassigned',role:'admin',status:'Active'});
 assert.deepEqual((await request(a).get('/api/students').expect(200)).body,[]);
 await request(a).get('/api/analytics?grade=Grade%2010').expect(400);
});
test('head can confirm a legacy section with missing grades; filters inherit grade without rewriting students',async()=>{
 const fixture=structuredClone(seed);
 fixture.sections[0].grade_level=null;
 fixture.students[0].grade_level=null;
 fixture.students[2].grade_level='  ';
 const db=fakeDb(fixture),a=app({id:'head',role:'super',status:'Active'},db);
 await request(a).patch('/api/sections/a').send({gradeLevel:'Grade 11'}).expect(200);
 assert.equal(db.tables.sections[0].grade_level,'Grade 11');
 assert.equal(db.tables.students[0].grade_level,null);
 assert.equal(db.writes.filter(w=>w.table==='students').length,0);
 const students=(await request(a).get('/api/students?grade=Grade%2011').expect(200)).body;
 assert.deepEqual(students.map(s=>s._id),['s1','mentor']);
 assert.ok(students.every(s=>s.gradeLevel==='Grade 11'));
 assert.equal(students[0].mastery.Phishing,0);
 await request(a).patch('/api/sections/a').send({gradeLevel:'Grade 12'}).expect(409);
});
test('grade confirmation rejects real conflicts, unauthorized teachers, missing sections and conflicts past page one',async()=>{
 const fixture=structuredClone(seed);fixture.sections[0].grade_level=null;
 fixture.students=Array.from({length:1001},(_,i)=>({id:'learner-'+i,section_id:'a',grade_level:i===1000?'Grade 12':null}));
 const db=fakeDb(fixture),a=app({id:'head',role:'super',status:'Active'},db);
 const conflict=await request(a).patch('/api/sections/a').send({gradeLevel:'Grade 11'}).expect(409);
 assert.match(conflict.body.error,/1 enrolled student.*Grade 12/);
 assert.equal(db.tables.sections[0].grade_level,null);
 await request(a).patch('/api/sections/missing').send({gradeLevel:'Grade 11'}).expect(404);
 await request(app(undefined,db)).patch('/api/sections/a').send({gradeLevel:'Grade 11'}).expect(403);
});
test('head grade filters, risk flags, heatmap and report share the same recorded values',async()=>{
 const a=app({id:'head',role:'super',status:'Active'});
 const analytics=(await request(a).get('/api/analytics?grade=Grade%2011').expect(200)).body;
 assert.deepEqual(analytics.students.map(s=>s._id),['s1','mentor']);
 assert.deepEqual(analytics.topics[0],{topic:'Phishing',assessed:2,unassessed:0,support:1,supportProportion:.5,mastery:.475});
 const risk=(await request(a).get('/api/analytics/at-risk?grade=Grade%2011').expect(200)).body;
 assert.equal(risk.length,1);assert.deepEqual(risk[0].mastery,analytics.students[0].mastery);
 const csv=await request(a).get('/api/reports/institutional?grade=Grade%2011&format=csv').expect(200);
 assert.match(csv.text,/"Phishing","2","0","1","0.5","0.475"/);assert.doesNotMatch(csv.text,/Learner Two/);
});
test('known zero mastery and confirmed zero tests remain valid; missing values are separate',()=>{
 const s=mapLearner(seed.students[0],seed.bkt_records);assert.equal(s.mastery.Phishing,0);assert.equal(s.mastery.Baiting,null);assert.equal(s.pre,0);assert.equal(s.gain,8);
 const unknown=mapLearner({id:'new',pre:0,post:0,mastery_phishing:0});assert.equal(unknown.pre,null);assert.equal(unknown.bkt,null);assert.equal(unknown.status,'Unassessed');
 assert.equal(mapLearner({...seed.students[0],post_scale:'different'},[]).gain,null);
 assert.equal(mapLearner({...seed.students[0],pre_completed_at:null},[]).gain,null);
 assert.equal(mapLearner({...seed.students[0],post_assessment_pair_id:'another'},[]).gain,null);
 assert.equal(mapLearner({...seed.students[0],post_completed_at:'2025-01-01'},[]).gain,null);
 assert.equal(recordedMastery({id:'x'},[{student_id:'x',topic:'Phishing',probability_known:.9},{student_id:'x',topic:'Phishing',probability_known:.1}]).Phishing,null);
 assert.equal(topicSummary([unknown])[0].supportProportion,null);
});
test('pagination includes records beyond the database default page and preserves zeros',async()=>{
 const rows=Array.from({length:1205},(_,id)=>({id,score:0}));
 const data=await allRows(fakeDb({records:rows}).from('records').select('*').order('id'));
 assert.equal(data.length,1205);assert.equal(data[1204].score,0);
});
test('reviews do not modify mentoring outcomes and remediation requires schedule',async()=>{
 const db=fakeDb(seed),a=app(undefined,db);
 await request(a).post('/api/interventions').send({studentId:'s1',kind:'remediation',topic:'Phishing',note:'Practice identifying senders'}).expect(400);
 const saved=await request(a).post('/api/interventions').send({studentId:'s1',kind:'review',topic:'Phishing',note:'Reviewed baseline'}).expect(201);
 assert.equal(saved.body.actor_id,'teacher');assert.equal(saved.body.section_id,'a');assert.equal(db.writes.some(w=>w.table==='support_bounties'),false);
 await request(a).patch('/api/interventions/'+saved.body.id).send({outcome:'Completed'}).expect(200);
});
test('bounties enforce participant identity, mastery eligibility, state and secret-code isolation',async()=>{
 const db=fakeDb({...seed,support_bounties:[{id:'b1',mentor_id:'mentor',mentee_id:'s1',topic:'Phishing',status:'AWAITING_LINK',clearance_code:'1234'}]});
 const teacher=app(undefined,db),mentor=app({id:'mentor',role:'student'},db),mentee=app({id:'s1',role:'student'},db);
 assert.equal((await request(teacher).get('/api/bounties').expect(200)).body[0].clearance_code,undefined);
 assert.equal((await request(mentor).get('/api/bounties/student/mentor').expect(200)).body[0].clearance_code,undefined);
 await request(mentor).get('/api/bounties/mentee-code/b1').expect(404);
 assert.equal((await request(mentee).get('/api/bounties/mentee-code/b1').expect(200)).body.clearance_code,'1234');
 await request(teacher).put('/api/bounties/b1/validate').expect(404);
 await request(mentor).put('/api/bounties/b1/validate').expect(404);
 await request(mentee).put('/api/bounties/b1/validate').expect(409);
 await request(mentor).post('/api/bounties/b1/verify-otp').send({code:'1234'}).expect(200);
 const completed=await request(mentee).put('/api/bounties/b1/validate').expect(200);assert.equal(completed.body.mentee_confirmed,true);
 await request(teacher).post('/api/bounties').send({mentor_id:'s2',mentee_id:'s1',topics:['Phishing']}).expect(404);
 await request(teacher).post('/api/bounties').send({mentor_id:'mentor',mentee_id:'s1',topics:['Baiting']}).expect(400);
 await request(teacher).post('/api/bounties').send({mentor_id:'mentor',mentee_id:'s1',topics:['Phishing']}).expect(201);
});
test('existing tokens are rejected after deactivation, despite Active token claims',async()=>{
 const db=fakeDb(seed),a=express();a.use(createAuthMiddleware(db,()=> 'secret'));a.get('/',(req,res)=>res.json(req.user));
 const token=jwt.sign({id:'teacher',role:'admin',status:'Active',email:'old@example.org'},'secret');
 await request(a).get('/').set('Authorization',`Bearer ${token}`).expect(200);
 db.tables.users[0].status='Inactive';
 await request(a).get('/').set('Authorization',`Bearer ${token}`).expect(401);
});
test('CSV escapes cells and PDF export produces a document with attachment headers',async()=>{
 assert.equal(csvCell('=SUM(1,2)'),`"'=SUM(1,2)"`);assert.equal(csvCell('a"b'),'"a""b"');assert.equal(csvCell(0),'"0"');
 const response=await request(app()).get('/api/reports/individual?studentId=s1&format=pdf').expect(200);
 assert.match(response.headers['content-type'],/application\/pdf/);assert.match(response.headers['content-disposition'],/attachment/);assert.equal(response.body.subarray(0,4).toString(),'%PDF');
});
