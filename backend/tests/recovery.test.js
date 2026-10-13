import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createRecoveryRoutes, recoveryMailer, validRecoveryPassword, RECEIPT } from '../src/routes/recoveryRoutes.js';

test('recovery migration is additive, scoped, single-use, expiring and atomic', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table users(id text primary key,role text,status text);
      create table students(id text primary key,name text,email text,section text,section_id text,password text,requires_password_change boolean,mastery_phishing numeric);
      create table teacher_sections(teacher_id text,section_id text);
      create table staff_events(id uuid default gen_random_uuid(),actor_id text,event_type text,entity_id text,details jsonb,created_at timestamptz default now());
      create table player_saves(student_id text,payload jsonb);
      insert into users values('teacher','admin','Active'),('outsider','admin','Active'),('head','super','Active'),('inactive','admin','Inactive');
      insert into students values('student','Test Student','student@example.test','Diamond','diamond','old-hash',true,.72);
      insert into teacher_sections values('teacher','diamond'),('inactive','diamond');
      insert into player_saves values('student','{"stage":7}');`);
    const sql = await readFile(new URL('../migrations/20261013_student_recovery.sql', import.meta.url), 'utf8');
    await db.exec(sql); await db.exec(sql);
    const query = async (sql, args = []) => (await db.query(sql, args)).rows;
    const create = async () => { await query('select levelblue_request_recovery($1)', ['student@example.test']); return (await query('select * from student_recovery order by requested_at desc limit 1'))[0]; };
    const hash = 'a'.repeat(64), hash2 = 'b'.repeat(64);
    await query('select levelblue_request_recovery($1)', ['unknown@example.test']);
    assert.equal((await query('select * from student_recovery')).length, 0);
    const row = await create(); await create();
    assert.equal((await query('select * from student_recovery')).length, 1);
    assert.equal((await query("select * from levelblue_recovery_queue('teacher')")).length, 1);
    assert.equal((await query("select * from levelblue_recovery_queue('outsider')")).length, 0);
    await assert.rejects(query("select * from levelblue_recovery_queue('inactive')"));
    await assert.rejects(query("select levelblue_decide_recovery('outsider',$1,'approve',$2)", [row.id, hash]));
    assert.equal((await query("select levelblue_decide_recovery('teacher',$1,'approve',$2) email", [row.id, hash]))[0].email, 'student@example.test');
    await assert.rejects(query("select levelblue_decide_recovery('teacher',$1,'approve',$2)", [row.id, hash2]));
    const hashed = await bcrypt.hash('NewStudent123!', 4);
    assert.equal((await query('select levelblue_consume_recovery($1,$2) ok', [hash, hashed]))[0].ok, false, 'unsent link cannot reset');
    await query('select levelblue_recovery_delivery($1,$2,false)', [row.id, hash]);
    assert.equal((await query('select token_hash from student_recovery'))[0].token_hash, null);
    await query("select levelblue_decide_recovery('teacher',$1,'approve',$2)", [row.id, hash2]);
    assert.equal((await query('select levelblue_recovery_delivery($1,$2,true) ok', [row.id, hash]))[0].ok, false, 'old sender cannot finalize new attempt');
    await query('select levelblue_recovery_delivery($1,$2,true)', [row.id, hash2]);
    await query("update students set email='changed@example.test'");
    assert.equal((await query('select levelblue_consume_recovery($1,$2) ok', [hash2, hashed]))[0].ok, false);
    await query("update students set email='student@example.test'");
    await assert.rejects(query('select levelblue_consume_recovery($1,$2)', [hash2, 'plaintext']));
    assert.equal((await query('select password from students'))[0].password, 'old-hash');
    const consumed = await Promise.all([query('select levelblue_consume_recovery($1,$2) ok', [hash2, hashed]), query('select levelblue_consume_recovery($1,$2) ok', [hash2, hashed])]);
    assert.equal(consumed.filter(rows => rows[0].ok).length, 1);
    const student = (await query('select * from students'))[0];
    assert.equal(Number(student.session_version), 1);
    assert.equal(student.requires_password_change, false);
    assert.equal(Number(student.mastery_phishing), .72);
    assert.deepEqual((await query('select payload from player_saves'))[0].payload, { stage: 7 });
    assert.equal(await bcrypt.compare('NewStudent123!', student.password), true);
    assert.equal((await query("select has_function_privilege('anon','levelblue_consume_recovery(text,text)','EXECUTE') ok"))[0].ok, false);
    assert.equal((await query("select has_table_privilege('authenticated','student_recovery','SELECT') ok"))[0].ok, false);
    const expired = await create();
    await query("select levelblue_decide_recovery('head',$1,'approve',$2)", [expired.id, hash]);
    await query('select levelblue_recovery_delivery($1,$2,true)', [expired.id, hash]);
    await query("update student_recovery set token_expires_at=now()-interval '1 second' where id=$1", [expired.id]);
    assert.equal((await query('select levelblue_consume_recovery($1,$2) ok', [hash, hashed]))[0].ok, false);
    const declined = await create();
    await query("select levelblue_decide_recovery('teacher',$1,'decline',null)", [declined.id]);
    await create();
    assert.equal((await query('select count(*)::int n from student_recovery'))[0].n, 3, 'daily account cap applies');
    assert.equal(Number((await query('select session_version from students'))[0].session_version), 1);
    const events = JSON.stringify(await query('select * from staff_events'));
    assert.ok(!events.includes(hash) && !events.includes(hashed) && !events.includes('student@example.test'));
  } finally { await db.close(); }
});

function fixture({ failMail = false, limit = 80, role = 'admin', configured = true } = {}) {
  const calls = [], emails = [];
  const db = { rpc: async (name, args) => { calls.push({ name, args }); return { data: name === 'levelblue_decide_recovery' ? 'stored@example.test' : name === 'levelblue_recovery_queue' ? [] : true }; } };
  const routes = createRecoveryRoutes(db, { minimumDelayMs: 0, limit, mailer: () => { if (!configured) throw Object.assign(new Error('Not configured'), { status: 503 }); return async (email, token) => { emails.push({ email, token }); if (failMail) throw new Error('Provider failed'); }; } });
  const app = express(); app.use(express.json()); app.use('/public', routes.publicRoutes);
  app.use('/staff', (req, _res, next) => { req.user = { id: 'teacher', role, status: 'Active' }; next(); }, routes.staffRoutes);
  app.use((error, _req, res, _next) => res.status(error.status || 500).json({ error: error.message }));
  return { app, calls, emails };
}
const id = '00000000-0000-0000-0000-000000000001';
test('public requests are neutral, normalized, rate limited and do not email', async () => {
  const { app, calls, emails } = fixture({ limit: 2 });
  for (const email of [' STUDENT@example.test ', 'unknown@example.test']) {
    const response = await request(app).post('/public/request').send({ email });
    assert.equal(response.status, 202); assert.deepEqual(response.body, { message: RECEIPT }); assert.equal(response.headers['cache-control'], 'no-store');
  }
  assert.equal(calls[0].args.p_email, 'student@example.test'); assert.equal(emails.length, 0);
  assert.equal((await request(app).post('/public/request').send({ email: 'student@example.test' })).status, 429);
});
test('only stored email is used; tokens are hashed and never returned', async () => {
  const { app, calls, emails } = fixture();
  const response = await request(app).post(`/staff/${id}/decision`).send({ action: 'approve', email: 'attacker@example.test' });
  assert.equal(response.status, 200); assert.equal(emails[0].email, 'stored@example.test');
  const digest = createHash('sha256').update(emails[0].token).digest('hex');
  assert.equal(calls[0].args.p_hash, digest); assert.equal(calls[1].args.p_sent, true);
  assert.ok(!JSON.stringify(response.body).includes(emails[0].token));
  const reset = await request(app).post('/public/reset').send({ token: emails[0].token, newPassword: 'NewStudent123!', confirmPassword: 'NewStudent123!' });
  assert.equal(reset.status, 200); assert.equal(calls[2].args.p_hash, digest);
  assert.equal(await bcrypt.compare('NewStudent123!', calls[2].args.p_password), true);
});
test('delivery failure clears token; missing config and non-staff cannot issue', async () => {
  const failed = fixture({ failMail: true });
  assert.equal((await request(failed.app).post(`/staff/${id}/decision`).send({ action: 'approve' })).status, 503);
  assert.equal(failed.calls[1].args.p_sent, false);
  for (const options of [{ configured: false }, { role: 'student' }]) {
    const f = fixture(options); const response = await request(f.app).post(`/staff/${id}/decision`).send({ action: 'approve' });
    assert.equal(response.status, options.role ? 403 : 503); assert.equal(f.calls.length, 0);
  }
});
test('password policy, malformed token and invalid email fail before database access', async () => {
  for (const bad of ['', 'testpassword123', 'ABC1234!', 'Aa1!' + 'é'.repeat(35)]) assert.equal(validRecoveryPassword(bad), false);
  const { app, calls } = fixture();
  assert.equal((await request(app).post('/public/request').send({ email: 'invalid' })).status, 400);
  assert.equal((await request(app).post('/public/reset').send({ token: 'bad' })).status, 400);
  assert.equal((await request(app).post('/public/reset').send({ token: 'a'.repeat(43), newPassword: 'weak', confirmPassword: 'weak' })).status, 400);
  assert.equal(calls.length, 0);
});
test('mailer requires secure configuration and puts token in fragment, never query', async () => {
  assert.throws(() => recoveryMailer({}));
  assert.throws(() => recoveryMailer({ STUDENT_RECOVERY_URL: 'http://example.test/student-reset', BREVO_API_KEY: 'fake', BREVO_SENDER_EMAIL: 'school@example.test' }));
  let body;
  const send = recoveryMailer({ STUDENT_RECOVERY_URL: 'https://example.test/student-reset', BREVO_API_KEY: 'fake', BREVO_SENDER_EMAIL: 'school@example.test' }, async (_url, options) => { body = JSON.parse(options.body); return { ok: true }; });
  await send('student@example.test', 'a'.repeat(43));
  assert.ok(body.textContent.includes('/student-reset#token=')); assert.ok(!body.textContent.includes('?token='));
});
