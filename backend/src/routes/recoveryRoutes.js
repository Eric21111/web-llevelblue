import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import bcrypt from 'bcryptjs';
import { handler, result, fail, staffOnly } from '../services/access.js';

export const RECEIPT = 'If this email belongs to a student account, your teacher will receive the request. After approval, check your registered inbox and spam folder for a reset link.';
const digest = token => createHash('sha256').update(token).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validRecoveryPassword(value) {
  return typeof value === 'string' && value.length >= 8 && Buffer.byteLength(value, 'utf8') <= 72 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value);
}

// Config is checked before reserving an approval. No development token fallback.
export function recoveryMailer(env = process.env, send = fetch) {
  let url;
  try { url = new URL(env.STUDENT_RECOVERY_URL); } catch { throw fail(503, 'Password recovery email is not configured. Contact the school administrator.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/student-reset' || !env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) throw fail(503, 'Configure a secure student reset URL and verified email sender.');
  return async (email, token) => {
    url.hash = `token=${token}`;
    const response = await send('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10000),
      headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME || 'LEVELBLUE' },
        to: [{ email }], subject: 'LEVELBLUE student password assistance',
        textContent: `Your teacher approved your password assistance request. Open this single-use link within 15 minutes to choose a new password:\n\n${url.href}\n\nYour learning progress will not change. If you did not request this, ignore this email. Never share this link or your password.` })
    });
    if (!response.ok) throw new Error('Email provider did not accept the message');
  };
}

export function createRecoveryRoutes(db, { mailer = () => recoveryMailer(), minimumDelayMs = 400, limit = 8 } = {}) {
  const publicRoutes = Router();
  publicRoutes.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  publicRoutes.use(rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please wait 15 minutes before trying again.' } }));
  publicRoutes.post('/request', handler(async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Enter your registered student email.');
    // Same response for known, unknown, duplicate and account-rate-limited requests.
    await Promise.all([result(db.rpc('levelblue_request_recovery', { p_email: email })), delay(minimumDelayMs)]);
    res.status(202).json({ message: RECEIPT });
  }));
  publicRoutes.post('/reset', handler(async (req, res) => {
    const { token, newPassword, confirmPassword } = req.body || {};
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail(400, 'This link is invalid or expired. Request assistance again from the game.');
    if (!validRecoveryPassword(newPassword) || confirmPassword !== newPassword) throw fail(400, 'Use matching passwords with 8+ characters, uppercase, lowercase, a number and a symbol (maximum 72 UTF-8 bytes).');
    const hashed = await bcrypt.hash(newPassword, 12);
    const consumed = await result(db.rpc('levelblue_consume_recovery', { p_hash: digest(token), p_password: hashed }));
    if (!consumed) throw fail(400, 'This link is invalid or expired. Request assistance again from the game.');
    res.json({ message: 'Password updated. Return to LEVELBLUE and sign in with your new password. Your learning progress is unchanged.' });
  }));

  const staffRoutes = Router();
  staffRoutes.use(staffOnly);
  staffRoutes.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  staffRoutes.get('/', handler(async (req, res) => res.json(await result(db.rpc('levelblue_recovery_queue', { p_actor: String(req.user.id) })))));
  staffRoutes.post('/:id/decision', handler(async (req, res) => {
    const action = req.body?.action;
    if (!uuid.test(req.params.id) || !['approve', 'decline'].includes(action)) throw fail(400, 'Choose a valid request and action.');
    const send = action === 'approve' ? mailer() : null;
    const token = action === 'approve' ? randomBytes(32).toString('base64url') : null;
    const hash = token ? digest(token) : null;
    const email = await result(db.rpc('levelblue_decide_recovery', { p_actor: String(req.user.id), p_id: req.params.id, p_action: action, p_hash: hash }));
    if (send) {
      let sent = false;
      try { await send(email, token); sent = true; } catch { /* Never log the link, provider payload or password. */ }
      const finalized = await result(db.rpc('levelblue_recovery_delivery', { p_id: req.params.id, p_hash: hash, p_sent: sent }));
      if (!sent || !finalized) throw fail(503, 'The reset email could not be confirmed. Refresh the queue and retry when available. The password has not changed.');
    }
    res.json({ message: send ? 'Email accepted for delivery. The student must open the link to change their password.' : 'Request declined. The student password is unchanged.' });
  }));
  return { publicRoutes, staffRoutes };
}
