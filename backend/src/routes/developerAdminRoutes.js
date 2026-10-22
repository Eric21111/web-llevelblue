import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { allRows, fail, handler, headOnly, result } from '../services/access.js';
import { contactDetails } from '../services/management.js';
import { createTeacherInvites } from '../services/teacherInvites.js';
import { credentialStorageReady, previewTemporaryPassword, storeTemporaryPassword } from '../services/teacherCredentials.js';
import { actorName } from '../utils/actor.js';

function fullName(firstName, middleInitial, lastName) {
  const initial = middleInitial ? ` ${middleInitial.toUpperCase().replace(/\./g, '')}.` : '';
  return `${firstName}${initial} ${lastName}`;
}
export function mapDeveloper(row) {
  return { _id: row.id, firstName: row.first_name, lastName: row.last_name, middleInitial: row.middle_initial, name: row.name, email: row.email, role: 'developer', roleLabel: 'Developer', status: row.status, createdAt: row.created_at };
}
async function developerAccess(db, actorId, developerId, status) {
  try { await result(db.rpc('levelblue_developer_access', { p_actor: String(actorId), p_developer: String(developerId), p_status: status })); }
  catch (error) {
    if (['PGRST202', '42883', 'PGRST205', '42P01'].includes(error.code)) throw fail(503, 'Apply backend/migrations/20261022_developer_role.sql before changing developer access.');
    if (error.code === 'P0001') throw fail(409, error.message);
    throw error;
  }
}

export function createDeveloperAdminRoutes(db) {
  const invites = createTeacherInvites(db);
  const router = express.Router();
  router.use(headOnly);
  router.get('/', handler(async (_req, res) => {
    const rows = await allRows(db.from('users').select('id,first_name,last_name,middle_initial,name,email,role,role_label,status,created_at').eq('role', 'developer').order('created_at', { ascending: false }));
    res.json(rows.map(mapDeveloper));
  }));
  router.post('/', handler(async (req, res) => {
    const { firstName, lastName, middleInitial, email } = contactDetails(req.body);
    const existing = await result(db.from('users').select('id').eq('email', email).maybeSingle());
    if (existing) throw fail(409, 'An account with this email already exists.');
    await invites.ready();
    await credentialStorageReady(db);
    const generatedPassword = randomBytes(9).toString('base64url');
    const inserted = await result(db.from('users').insert({
      first_name: firstName, last_name: lastName, middle_initial: middleInitial, name: fullName(firstName, middleInitial, lastName),
      email, password: await bcrypt.hash(generatedPassword, 10), role: 'developer', role_label: 'Developer', sections: 0, students: 0, status: 'Invited',
    }).select('id,first_name,last_name,middle_initial,name,email,role,role_label,status,created_at,password').single());
    let temporaryPasswordStored = false;
    try { temporaryPasswordStored = await storeTemporaryPassword(db, inserted, generatedPassword); } catch { temporaryPasswordStored = false; }
    let invitationEmailSent = true;
    try { await invites.send(inserted); } catch { invitationEmailSent = false; }
    await db.from('logs').insert({ user: actorName(req, 'Super Admin'), action: 'Create Developer Account', details: `Created developer account for ${firstName} ${lastName} (${email})` });
    const account = mapDeveloper(inserted);
    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ ...account, generatedPassword, invitationEmailSent, temporaryPasswordStored });
  }));
  router.patch('/:id', handler(async (req, res) => {
    if (!['Active', 'Inactive'].includes(req.body?.status)) throw fail(400, 'Choose Active or Inactive.');
    await developerAccess(db, req.user.id, req.params.id, req.body.status);
    await db.from('logs').insert({ user: actorName(req, 'Super Admin'), action: 'Update Developer Access', details: `Set developer ${req.params.id} to ${req.body.status}` });
    res.json({ success: true });
  }));
  router.get('/:id/temporary-password', handler(async (req, res) => {
    const developer = await result(db.from('users').select('id,role').eq('id', req.params.id).maybeSingle());
    if (!developer || developer.role !== 'developer') throw fail(404, 'Developer not found.');
    res.setHeader('Cache-Control', 'no-store, private');
    res.json(await previewTemporaryPassword(db, req.user, req.params.id));
  }));
  return router;
}
