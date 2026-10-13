import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import {writeFileSync} from 'node:fs';
import {fakeDb,seed} from './helpers.js';
import {dashboardDay,dashboardData,dashboardRows} from '../src/services/dashboardExport.js';
import {createWorkspaceRoutes} from '../src/routes/workspaceRoutes.js';

const query={date:'2026-10-12',startOffset:'-480',endOffset:'-480'};
const teacher={id:'teacher',role:'admin',status:'Active'};
const record=(id,student,time,kind='pretest',data={})=>({id,event_id:id,student_id:student,occurred_at:time,received_at:time,module_id:'mod_01',kind,data:{topic:'Phishing',completed:true,score:0,correct:0,total:5,instrument:'pretest-v1',source:'server-graded',...data}});
function database(){return fakeDb({...seed,learning_records:[
  record('before','s1','2026-10-11T15:59:59Z'),
  record('included','s1','2026-10-11T16:00:00Z'),
  record('end','s1','2026-10-12T16:00:00Z'),
  record('foreign','s2','2026-10-12T00:00:00Z'),
  record('zero','s1','2026-10-12T01:00:00Z','mastery',{mastery:0}),
  record('stage','s1','2026-10-12T01:00:00Z','stage',{stage:1,outcome:'cleared',attempt_id:'attempt-1'}),
],feedback:[{id:'f1',student_id:'s1',section_id:'a',respondent_role:'student',created_at:'2026-10-12T00:00:00Z'},{id:'f2',student_id:'s1',section_id:'b',respondent_role:'student',created_at:'2026-10-12T00:00:00Z'}],learning_interventions:[{id:'i1',student_id:'s1',section_id:'a',kind:'review',created_at:'2026-10-12T00:00:00Z'}]});}
function app(db){const a=express();a.use((req,res,next)=>{req.user={...teacher,id:req.get('x-user')||'teacher',role:req.get('x-role')||'admin',status:req.get('x-status')||'Active'};next();});a.use('/api',createWorkspaceRoutes(db));a.use((e,req,res,next)=>res.status(e.status||500).json({error:e.message}));return a;}

test('export dates use local midnight, exclusive end, and DST offsets',()=>{
  assert.deepEqual(dashboardDay(query),{date:'2026-10-12',start:'2026-10-11T16:00:00.000Z',end:'2026-10-12T16:00:00.000Z'});
  const dst=dashboardDay({date:'2026-03-08',startOffset:'300',endOffset:'240'});
  assert.equal(Date.parse(dst.end)-Date.parse(dst.start),23*3600000);
  for(const patch of [{date:'2026-02-30'},{date:'not-a-date'},{date:'2999-01-01'},{startOffset:'Infinity'},{startOffset:['0']},{endOffset:'800'},{endOffset:'0'}])assert.throws(()=>dashboardDay({...query,...patch}),e=>e.status===400);
});
test('daily evidence preserves zero and excludes another section and adjacent days',async()=>{
  const data=await dashboardData(database(),teacher,query);
  assert.equal(data.students.length,2);assert.equal(data.evidence.assessments.length,1);
  assert.equal(data.evidence.assessments[0].event_id,'included');
  assert.equal(data.evidence.assessments[0].data.score,0);
  assert.equal(data.dailyTopics[0].mastery,0);assert.equal(data.dailyTopics[1].mastery,null);
  assert.equal(data.feedback.length,1);assert.equal(data.interventions.length,1);
  assert.equal(data.faculty,null);assert.equal(data.evidence.cleared,1);
  assert.ok(dashboardRows(data).some(row=>row[0]==='Report basis'&&row[1].includes('not a historical snapshot')));
  await assert.rejects(dashboardData(database(),teacher,{...query,sectionName:'Sapphire'}),e=>e.status===403);
  await assert.rejects(dashboardData(database(),teacher,{...query,sectionId:'b'}),e=>e.status===403);
});
test('empty dates do not replace missing observations with zero and head has school scope',async()=>{
  const data=await dashboardData(database(),{id:'head',role:'super'},{...query,date:'2026-09-01'});
  assert.equal(data.students.length,3);assert.equal(data.faculty.length,1);
  assert.equal(data.evidence.assessments.length,0);assert.equal(data.recordedLearners,0);
  assert.ok(data.dailyTopics.every(t=>t.mastery===null));
  const co=await dashboardData(database(),{...teacher,id:'co-teacher'},query);
  assert.equal(co.students.length,2);
});
test('dashboard CSV/PDF endpoints enforce staff scope and valid formats',async()=>{
  const db=database(),a=app(db);
  for(const format of ['csv','pdf']) {
    const result=await request(a).get('/api/dashboard/export').query({...query,format});
    assert.equal(result.status,200);assert.equal(result.headers['cache-control'],'no-store');
    assert.match(result.headers['content-disposition'],new RegExp(`LEVELBLUE-dashboard-2026-10-12\\.${format}`));
    if(format==='csv'){assert.match(result.text,/Learner One/);assert.doesNotMatch(result.text,/Learner Two/);assert.match(result.text,/CURRENT OVERVIEW/);}
    else {assert.equal(result.body.subarray(0,5).toString(),'%PDF-');if(process.env.DASHBOARD_PREVIEW_PDF)writeFileSync(process.env.DASHBOARD_PREVIEW_PDF,result.body);}
  }
  for(const format of ['csv','pdf']){
    assert.equal((await request(a).get('/api/dashboard/export').query({...query,format,sectionId:'b'})).status,403);
    assert.equal((await request(a).get('/api/dashboard/export').set('x-role','student').query({...query,format})).status,403);
    assert.equal((await request(a).get('/api/dashboard/export').set('x-status','Inactive').query({...query,format})).status,403);
  }
  assert.equal((await request(a).get('/api/dashboard/export').query({...query,format:'exe'})).status,400);
  assert.equal((await request(a).get('/api/dashboard/export').query({...query,date:'2026-02-30',format:'csv'})).status,400);
  db.tables.students[0].name='=HYPERLINK("example")';
  const csv=await request(a).get('/api/dashboard/export').query({...query,format:'csv'});
  assert.ok(csv.text.includes("'=HYPERLINK"));
});
