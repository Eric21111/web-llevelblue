import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';

test('cloud-save migration supports per-student upserts, preserves existing data, and restricts client access',async()=>{
 const db=new PGlite();
 const student='00000000-0000-0000-0000-000000000001';
 try{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
   create table public.students(id uuid primary key,mastery numeric,pre integer);
   insert into public.students values('${student}',0,0);`);
  const before=(await db.query('select * from students')).rows;
  const migration=await readFile(new URL('../migrations/20261008_player_saves.sql',import.meta.url),'utf8');
  await db.exec(migration);
  const initial={mastery_matrix:{phishing:0},unlocked_skills:['phishing'],module_pretests:{mod_01:true},credits:0};
  await db.exec('set role service_role');
  await db.query('insert into player_saves(student_id,payload) values($1,$2)',[student,JSON.stringify(initial)]);
  assert.deepEqual((await db.query('select payload from player_saves where student_id=$1',[student])).rows[0].payload,initial);
  const updated={...initial,credits:25,lesson_progress:{mod_01:2}};
  await db.query('insert into player_saves(student_id,payload,updated_at) values($1,$2,now()) on conflict(student_id) do update set payload=excluded.payload,updated_at=excluded.updated_at',[student,JSON.stringify(updated)]);
  assert.equal((await db.query('select count(*)::int n from player_saves')).rows[0].n,1);
  assert.deepEqual((await db.query('select payload from player_saves')).rows[0].payload,updated);
  await assert.rejects(db.query("insert into player_saves(student_id,payload) values('00000000-0000-0000-0000-000000000099','{}')"));
  await assert.rejects(db.query("update player_saves set payload='[]'"));
  await db.exec('reset role');
  await db.exec(migration);
  assert.deepEqual((await db.query('select payload from player_saves')).rows[0].payload,updated);
  assert.deepEqual((await db.query('select * from students')).rows,before);
  await assert.rejects(db.query('delete from students where id=$1',[student]));
  for(const role of ['anon','authenticated']){
   await db.exec(`set role ${role}`);
   await assert.rejects(db.query('select * from player_saves'));
   await assert.rejects(db.query("update player_saves set payload='{}'"));
   await db.exec('reset role');
  }
 }finally{await db.close();}
});
