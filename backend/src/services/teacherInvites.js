import { createHmac, randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const fail = (status, message) => Object.assign(new Error(message), { status });
export function inviteDigest(user, value, secret = process.env.JWT_SECRET) {
  return createHmac('sha256', secret).update(JSON.stringify(['teacher-invite', String(user.id), user.email, user.password, value])).digest('hex');
}
export function inviteChallenge(user) {
  return jwt.sign({ id: String(user.id), email: user.email, purpose: 'teacher-invite', credential: inviteDigest(user, 'credential') }, process.env.JWT_SECRET, { expiresIn: '15m' });
}
export function validInvitePassword(password) {
  return typeof password === 'string' && password.length >= 8 && Buffer.byteLength(password, 'utf8') <= 72 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password);
}
function checked({ data, error }) {
  if (error) {
    if (['42P01','42883','PGRST202','PGRST205'].includes(error.code)) throw fail(503, 'Teacher email verification needs the 20261015_teacher_invites.sql migration. Contact your school head.');
    throw fail(503, 'Teacher verification is unavailable. Please try again.');
  }
  const errors = {
    session: [401, 'This invitation session has ended. Sign in again with your temporary password.'],
    locked: [429, 'Too many incorrect codes. Wait 15 minutes, then request a new code.'],
    cooldown: [429, 'Wait 60 seconds before requesting another code.'],
    limit: [429, 'The email limit has been reached. Try again in one hour.'],
    setup: [401, 'Password setup has expired or changed. Sign in again and verify a new email code.'],
    expired: [400, 'Your code has expired. Request a new code.'],
    invalid: [400, 'The code is invalid or no longer available. Use the latest email or request a new code.'],
  };
  if (data?.error) throw fail(...(errors[data.error] || [503, 'Teacher verification is unavailable.']));
  return data;
}

export async function sendTeacherInviteEmail(email, code) {
  if (!process.env.BREVO_API_KEY || !process.env.BREVO_SENDER_EMAIL) throw fail(503, 'Email delivery is not configured. Contact your school head.');
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { accept: 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { name: process.env.BREVO_SENDER_NAME || 'LEVELBLUE Security', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email }], subject: 'Your LEVELBLUE teacher activation code',
      textContent: `Your school head has invited you to LEVELBLUE.\n\nYour activation code is: ${code}\n\nSign in with the temporary password provided separately by your school head, then enter this code and choose a new password. This code expires in 10 minutes. You can request a fresh code after signing in.\n\nDo not share this code. If you were not expecting an account, contact your school head.`,
    }),
  });
  if (!response.ok) throw fail(503, 'The email service could not send your code. Please try again later.');
}

export function createTeacherInvites(db, sendEmail = sendTeacherInviteEmail) {
  async function authenticated(token, purpose) {
      let claims;
      try { claims = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
      catch { throw fail(401, 'Your invitation session has expired. Sign in again.'); }
      if (claims.purpose !== purpose || typeof claims.id !== 'string') throw fail(401, 'Sign in with your temporary password first.');
      const user = checked(await db.from('users').select('*').eq('id', claims.id).maybeSingle());
      if (!user || user.role !== 'admin' || user.status !== 'Invited' || user.email !== claims.email || inviteDigest(user, 'credential') !== claims.credential) throw fail(401, 'Your invitation has changed or is no longer active. Sign in again or contact your school head.');
      return { user, claims };
  }
  return {
    async ready() { checked(await db.from('teacher_invites').select('user_id', { head: true }).limit(1)); },
    async send(user) {
      const code = String(randomInt(100000, 1000000));
      const digest = inviteDigest(user, code);
      checked(await db.rpc('levelblue_invite_send', { p_user: String(user.id), p_email: user.email, p_password: user.password, p_hash: digest }));
      try { await sendEmail(user.email, code); }
      catch {
        // Revoke only this send, without clearing a concurrently replaced code.
        await db.from('teacher_invites').update({ code_hash: null, expires_at: null }).eq('user_id', String(user.id)).eq('code_hash', digest);
        throw fail(503, 'Your account requires email verification, but the code could not be sent. Try Resend code after 60 seconds or contact your school head.');
      }
    },
    async authenticate(token) { return (await authenticated(token, 'teacher-invite')).user; },
    async verify(user, code) {
      if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw fail(400, 'Enter the six-digit code from your email.');
      const grant = randomUUID();
      checked(await db.rpc('levelblue_invite_verify', { p_user: String(user.id), p_email: user.email, p_password: user.password, p_hash: inviteDigest(user, code), p_grant_hash: inviteDigest(user, grant) }));
      return jwt.sign({ id: String(user.id), email: user.email, purpose: 'teacher-password-setup', credential: inviteDigest(user, 'credential'), grant }, process.env.JWT_SECRET, { expiresIn: '10m' });
    },
    async activate(token, password) {
      const { user, claims } = await authenticated(token, 'teacher-password-setup');
      if (!validInvitePassword(password)) throw fail(400, 'Use at least 8 characters with uppercase, lowercase, a number and a symbol (maximum 72 bytes).');
      if (await bcrypt.compare(password, user.password)) throw fail(400, 'Choose a password different from your temporary password.');
      const hash = await bcrypt.hash(password, 12);
      checked(await db.rpc('levelblue_invite_activate', { p_user: String(user.id), p_email: user.email, p_password: user.password, p_grant_hash: inviteDigest(user, claims.grant), p_new_password: hash }));
      return { ...user, status: 'Active', password: hash };
    },
  };
}
