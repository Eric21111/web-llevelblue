import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import express from 'express';
import request from 'supertest';
import {fakeDb,seed} from './helpers.js';
import {createWorkspaceRoutes} from '../src/routes/workspaceRoutes.js';
import {summarizeEvidence,attachLearningEvidence} from '../src/services/learningRecords.js';

const event=(id,kind,data={},student='s1',time='2026-10-08T12:00:00Z')=>({id,event_id:id,student_id:student,kind,module_id:'mod_01',occurred_at:time,received_at:time,data:{topic:'Phishing',...data}});
const completed={completed:true,score:0,correct:0,total:25,scale:'percent',instrument:'pre-v1',comparison_key:'approved-blueprint-v1'};

test('evidence distinguishes zero scores, comparable pairs, incomplete attempts, and dated observations',()=>{
 const records=[event('a','pretest',completed),event('b','posttest',{...completed,score:40},'s1','2026-10-09T12:00:00Z'),event('c','stage',{attempt_id:'one',stage:1,outcome:'started'}),event('d','stage',{attempt_id:'one',stage:1,outcome:'cleared'}),event('e','stage',{attempt_id:'two',stage:2,outcome:'abandoned'})];
 const s=summarizeEvidence(records);assert.equal(s.assessments[0].data.score,0);assert.equal(s.pairs[0].gain,40);assert.equal(s.started,2);assert.equal(s.clearanceRate,1);assert.equal(s.incomplete,1);
 for(const patch of [{comparison_key:null},{comparison_key:'other'},{scale:'points'}])assert.equal(summarizeEvidence([records[0],{...records[1],data:{...records[1].data,...patch}}]).pairs.length,0);
 assert.equal(summarizeEvidence([records[0],{...records[1],occurred_at:'2026-10-07T12:00:00Z'}]).pairs.length,0);
 assert.equal(summarizeEvidence([]).clearanceRate,null);
 assert.equal(summarizeEvidence([event('x','posttest',{...completed,completed:false})]).assessments.length,0);
});

test('daily trends use last dated value per learner, include zero, and expose missing schema',async()=>{
 const db=fakeDb({learning_records:[event('a','mastery',{mastery:0}),event('b','mastery',{mastery:.6},'s1','2026-10-08T13:00:00Z'),event('c','mastery',{mastery:0},'mentor')]});
 const data=await attachLearningEvidence(db,{students:[{_id:'s1'},{_id:'mentor'}]});
 assert.deepEqual(data.evidence.trends,[{date:'2026-10-08',topic:'Phishing',assessed:2,mastery:.3}]);
 assert.equal((await attachLearningEvidence(fakeDb({}),{students:[{_id:'s1'}]})).evidence.available,false);
 const failing={from(){throw {code:'XX000'}}};await assert.rejects(attachLearningEvidence(failing,{students:[{_id:'s1'}]}));
});

test('analytics and exports scope learning records to authorized students and co-teachers',async()=>{
 const db=fakeDb({...seed,learning_records:[event('a','pretest',completed),event('foreign','pretest',{...completed,instrument:'SECRET_FOREIGN_RECORD'},'s2')]});
 for(const role of ['teacher','co-teacher']){
  const app=express();app.use((req,res,next)=>{req.user={id:role,role:'admin',status:'Active'};next();});app.use('/api',createWorkspaceRoutes(db));app.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));
  const analytics=(await request(app).get('/api/analytics').expect(200)).body;
  assert.equal(analytics.evidence.assessments,1);assert.equal(analytics.students[0].evidence.assessments[0].data.score,0);
  const csv=await request(app).get('/api/reports/individual?studentId=s1&format=csv').expect(200);
  assert.match(csv.text,/"0","25","0","percent"/);assert.doesNotMatch(csv.text,/SECRET_FOREIGN_RECORD/);
  await request(app).get('/api/reports/individual?studentId=s2&format=csv').expect(404);
  await request(app).get('/api/analytics?sectionId=b').expect(403);
 }
});

test('migration is additive, retry-safe, immutable, atomic, and server-only',async()=>{
 const db=new PGlite();
 try{
  await db.exec("create role anon;create role authenticated;create role service_role;create table students(id uuid primary key,mastery numeric);insert into students values('00000000-0000-0000-0000-000000000001',.4);");
  const sql=await readFile(new URL('../migrations/20261008_learning_records.sql',import.meta.url),'utf8');await db.exec(sql);await db.exec(sql);
  const id='00000000-0000-0000-0000-000000000001';
  const record={event_id:'00000000-0000-0000-0000-000000000002',kind:'mastery',module_id:'mod_01',occurred_at:'2026-10-08T00:00:00Z',data:{topic:'Phishing',mastery:0}};
  const write=rows=>db.query('select levelblue_record_learning($1,$2::jsonb)',[id,JSON.stringify(rows)]);
  await write([record]);await write([record]);assert.equal((await db.query('select count(*)::int n from learning_records')).rows[0].n,1);
  await assert.rejects(write([{...record,event_id:'00000000-0000-0000-0000-000000000003'},{...record,data:{mastery:.8}}]));
  assert.equal((await db.query('select count(*)::int n from learning_records')).rows[0].n,1);
  assert.equal(Number((await db.query('select mastery from students')).rows[0].mastery),.4);
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);await assert.rejects(db.query('select * from learning_records'));await assert.rejects(write([record]));await db.exec('reset role');
  }
 }finally{await db.close();}
});
