const SECRET = /bearer\s+\S+|password[=:]\s*\S+|api[_-]?key[=:]\s*\S+/gi;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function sanitizeMonitorMessage(value) {
  return String(value ?? '')
    .replace(SECRET, '[redacted]')
    .replace(EMAIL, '[redacted-email]')
    .slice(0, 300);
}

export function safeRoute(req) {
  const pattern = req?.route?.path ? `${req.baseUrl || ''}${req.route.path}` : (req?.path || '');
  return String(pattern)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
    .replace(/[^A-Za-z0-9_./:-]/g, '')
    .slice(0, 120);
}

export async function logOperationalEvent(db, event) {
  try {
    await db.rpc('levelblue_log_operational_event', {
      p_category: event.category,
      p_message: sanitizeMonitorMessage(event.message),
      p_code: event.code || null,
      p_route: event.route || null,
      p_status: Number.isInteger(event.status) ? event.status : null,
    });
  } catch (error) {
    console.error('Operational event was not stored:', error.code || 'unavailable');
  }
}
