// Longer than the backend's 15-second email-provider timeout so its own error message can arrive first.
export const INVITE_REQUEST_TIMEOUT_MS = 30000;
export const RESEND_COOLDOWN_SECONDS = 60;

export class InviteRequestError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export async function postInviteAction(fetchImpl, action, body, timeoutMs = INVITE_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(`/api/auth/teacher-invite/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new InviteRequestError(controller.signal.aborted
        ? 'The server took too long to respond. Check your connection and try again.'
        : 'We couldn’t connect. Check your internet connection and try again.');
    }
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new InviteRequestError(data?.error || (response.status >= 500
        ? 'Email verification is temporarily unavailable. Please try again.'
        : 'Verification could not continue. Please try again.'), response.status);
    }
    return data || {};
  } finally {
    clearTimeout(timer);
  }
}

// The server reserves a send (and its 60-second cooldown) before contacting the provider, so a 503 also waits.
export function resendCooldownAfter(status) {
  return status === 429 || status === 503 ? RESEND_COOLDOWN_SECONDS : 0;
}

export async function withPending(setPending, key, task) {
  setPending(key);
  try {
    return await task();
  } finally {
    setPending('');
  }
}
