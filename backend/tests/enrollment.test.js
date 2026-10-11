import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import request from 'supertest';
import {fakeDb,seed} from './helpers.js';
import {learners} from '../src/services/access.js';
import {createEnrollmentRoutes} from '../src/routes/enrollmentRoutes.js';
import {createWorkspaceRoutes} from '../src/routes/workspaceRoutes.js';
import {teacherOversight} from '../src/services/oversight.js';

test('promotion and graduation are atomic, scoped, retry-safe and preserve progress',async()=>{
 const db=new PGlite();const student=randomUUID(),other=randomUUID();
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;
   create table users(id text primary key,role text,status text);insert into users values('head','super','Active'),('teacher','admin','Active'),('stranger','admin','Active'),('student','student','Active');
   create table sections(scope_id text primary key,name text,grade_level text);insert into sections values('a','Emerald','Grade 11'),('b','Sapphire','Grade 12'),('c','Foreign','Grade 12');
   create table teacher_sections(teacher_id text,section_id text);insert into teacher_sections values('teacher','a'),('teacher','b');
   create table students(id uuid primary key,section text,section_id text,grade_level text,mastery numeric,unlocks jsonb);
   create table staff_events(id uuid default gen_random_uuid(),actor_id text,event_type text,entity_id text,details jsonb);
   create table support_bounties(id text,mentor_id uuid,mentee_id uuid,status text,cancelled_at timestamptz,created_by text default 'teacher');
   create table player_saves(student_id uuid,payload jsonb);create table bkt_records(student_id uuid,mastery numeric);
   create table learning_records(student_id uuid,data jsonb);create table feedback(student_id uuid,section_id text,comments text);`);
  await db.query("insert into students values($1,'Emerald','a','Grade 11',.35,'[\"phishing\"]'),($2,'Emerald','a','Grade 11',.6,'[]')",[student,other]);
  await db.query("insert into player_saves values($1,'{\"unlocked_skills\":[\"phishing\"],\"credits\":0}')",[student]);
  await db.query('insert into bkt_records values($1,.35)',[student]);
  await db.query("insert into learning_records values($1,'{\"score\":0}')",[student]);
  await db.query("insert into feedback values($1,'a','Original section')",[student]);
  const snapshot=async()=>Object.fromEntries(await Promise.all(['player_saves','bkt_records','learning_records','feedback'].map(async t=>[t,(await db.query(`select * from ${t}`)).rows])));
  const before=await snapshot();const sql=await readFile(new URL('../migrations/20261011_enrollment.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  const body={action:'promote',sourceId:'a',targetId:'b',fromYear:'2026-2027',toYear:'2027-2028',students:[{id:student,version:0}]};
  const move=(actor,payload=body,batch=randomUUID())=>db.query('select levelblue_transition_enrollment($1,$2,$3::jsonb) result',[actor,batch,JSON.stringify(payload)]);
  await assert.rejects(move('stranger'));await assert.rejects(move('student'));
  await assert.rejects(move('teacher',{...body,targetId:'c'}));
  await assert.rejects(move('teacher',{...body,students:[{id:student,version:0},{id:other,version:9}]}));
  assert.equal((await db.query('select count(*)::int n from enrollment_history')).rows[0].n,0);
  assert.equal((await db.query('select section_id from students where id=$1',[student])).rows[0].section_id,'a');
  await assert.rejects(move('teacher',{...body,toYear:'2028-2029'}));
  await db.query("insert into support_bounties values('pending',$1,$2,'PENDING',null)",[student,other]);await assert.rejects(move('teacher'));
  await db.exec("update support_bounties set cancelled_at=now()");
  const batch=randomUUID();await move('teacher',body,batch);assert.equal((await move('teacher',body,batch)).rows[0].result.replayed,true);
  await assert.rejects(move('teacher',{...body,toYear:'2029-2030'},batch));await assert.rejects(move('teacher'));
  const promoted=(await db.query('select * from students where id=$1',[student])).rows[0];
  assert.equal(promoted.id,student);assert.equal(promoted.section_id,'b');assert.equal(promoted.grade_level,'Grade 12');assert.equal(promoted.academic_year,'2027-2028');assert.equal(promoted.enrollment_version,1);assert.equal(Number(promoted.mastery),.35);assert.deepEqual(promoted.unlocks,['phishing']);
  // An old mobile write cannot restore an obsolete section, grade or lifecycle state.
  await assert.rejects(db.query("update students set section='Emerald',section_id='a',grade_level='Grade 11' where id=$1",[student]));
  await assert.rejects(db.query('update students set enrollment_version=0 where id=$1',[student]));
  await db.query('update students set mastery=.35 where id=$1',[student]);
  await move('head',{action:'graduate',sourceId:'b',targetId:null,fromYear:'2027-2028',toYear:null,students:[{id:student,version:1}]});
  assert.equal((await db.query('select enrollment_status from students where id=$1',[student])).rows[0].enrollment_status,'graduated');
  await assert.rejects(db.query("insert into support_bounties values('stale',$1,$2,'PENDING',null)",[student,other]));
  assert.equal((await db.query('select count(*)::int n from enrollment_history')).rows[0].n,2);
  assert.deepEqual(await snapshot(),before);
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await assert.rejects(move('head'));await assert.rejects(db.query('select * from enrollment_history'));await db.exec('reset role');}
 }finally{await db.close();}
});

test('archived filtering never expands teacher scope, and students cannot transition enrollment',async()=>{
 const db=fakeDb({...seed,students:seed.students.map(s=>({...s,enrollment_status:s.id==='s1'?'graduated':'active'}))});
 const teacher={id:'teacher',role:'admin',status:'Active'};
 assert.deepEqual((await learners(db,teacher)).students.map(s=>s._id),['mentor']);
 assert.deepEqual((await learners(db,teacher,{enrollment:'graduated'})).students.map(s=>s._id),['s1']);
 await assert.rejects(learners(db,teacher,{enrollment:'all',sectionId:'b'}));
 const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:'s1',role:'student'};next();});app.use(createEnrollmentRoutes(db));
 await request(app).post('/').send({}).expect(403);await request(app).get('/').expect(403);
});

test('teacher oversight counts actions without conflating teacher reviews and student confirmation',async()=>{
 const date=new Date().toISOString();const db=fakeDb({...seed,users:[...seed.users,{id:'co-teacher',name:'Co teacher',role:'admin',status:'Active'}],staff_events:[{id:'1',actor_id:'teacher',event_type:'review',created_at:date,details:{section_id:'a'}},{id:'2',actor_id:'teacher',event_type:'bounty-review',created_at:date,details:{section_id:'a'}},{id:'3',actor_id:'teacher',event_type:'remediation',created_at:'2000-01-01',details:{section_id:'a'}},{id:'4',actor_id:'teacher',event_type:'review',created_at:date,details:{section_id:'b'}}],support_bounties:[{id:'one',mentee_id:'s1',status:'PENDING'},{id:'two',mentee_id:'s1',status:'VALIDATED'}]});
 const report=await teacherOversight(db,{days:30});const t=report.teachers[0],co=report.teachers[1];assert.equal(t.reviews,1);assert.equal(t.remediation,0);assert.equal(t.bountyReviews,1);assert.equal(t.openBounties,1);assert.equal(t.studentConfirmedBounties,1);assert.equal(co.reviews,0);assert.equal(co.lastRecordedAction,null);
 await assert.rejects(teacherOversight(db,{days:999}));
 for(const role of ['admin','student']){const app=express();app.use((req,res,next)=>{req.user={id:'teacher',role,status:'Active'};next();});app.use(createWorkspaceRoutes(db));await request(app).get('/teacher-activity').expect(403);}
});
