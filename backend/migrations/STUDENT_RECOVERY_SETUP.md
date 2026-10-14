# Student password assistance deployment

Source implementation only: the migration and tests do not send real emails or alter hosted accounts.

## Deploy in this order

1. Apply `20261013_student_recovery.sql` to the shared Supabase database **after web foundations**. It adds a private recovery queue and `students.session_version`; existing IDs, passwords, learning records, BKT and saves are preserved.
2. Deploy **both** authentication backends: the web Node backend and mobile Python backend must check `session_version`. Do not enable recovery while either backend still accepts old sessions. Restart the Python worker to load the new PvP socket recheck.
3. Deploy the web frontend, with an SPA rewrite for `/student-reset` to `index.html`. Set its existing `VITE_API_URL` to the web API origin before building.
4. Configure the web backend environment: `STUDENT_RECOVERY_URL=https://YOUR-WEB-FRONTEND/student-reset`, `BREVO_API_KEY`, and a **verified** `BREVO_SENDER_EMAIL`. Optional: `BREVO_SENDER_NAME`. Never use the API host for the reset URL unless it also serves the frontend. Never commit these credentials.
5. Set `TRUST_PROXY_HOPS=1` only if requests reach Express through exactly one trusted reverse proxy and clients cannot bypass it. Otherwise keep `0`. Validate client-IP handling on the deployed host: rate limits are 8 recovery requests per IP per 15 minutes, so incorrect proxy handling can group all students together. The IP limiter is process-local; multi-instance deployments need a shared limiter/edge policy before scaling. Per-student deduplication and the 3-request/day cap are database-backed.
6. Build the mobile game with `levelblue/recovery_api_base_url` pointing to the web backend. Current configured value: `https://web-llevelblue.onrender.com`.

## Acceptance test with an authorized disposable student

- Request assistance from the mobile login screen; confirm the neutral receipt appears for known and unknown emails. No account information is disclosed publicly.
- Confirm only assigned active teachers (and the school head) see the request. With no teacher assignment, the head handles it. Notification polling is every 30 seconds while the web page is visible, not a push notification.
- Approve once. Confirm delivery to the student's stored email, not a caller-supplied address. Brevo acceptance is not proof of inbox delivery; check spam/bounces.
- Open the link, set a compliant password and return to game login. Confirm identity, mastery, saves and progress are unchanged. Old REST tokens must return 401; an old open PvP socket closes on its next session recheck (15 seconds plus database latency).
- Reuse the link, try an expired link, decline a request, and simulate delivery failure. None may change the password. Failed/uncertain sends do not leave usable links; a crashed `issuing` attempt becomes retryable after two minutes. Reset links last at most 15 minutes and the request itself at most 24 hours. Unknown/duplicate requests receive the same public receipt.
- Do not use this flow if the student cannot access the registered inbox. Resolve identity/email through the school's existing verified account-support process; do not let public callers replace the recovery address.

## Security / operations

Tokens are random 32-byte values; only SHA-256 hashes are stored. Links put the token in the URL fragment (not access-log query strings); the reset page clears that fragment on mount and keeps it only in component memory. Refreshing requires reopening the original email. Never add analytics/session recording to the reset page or log request bodies, email payloads, tokens or passwords.

Only a successful atomic reset increments session version. Asking for help or approving an email does not lock an account. Active sockets fail closed if session verification is unavailable. Database role `service_role` alone can invoke recovery RPCs; the app derives staff IDs from verified JWTs. The queue shows up to 200 requests from the last 30 days. Recovery metadata and audit events persist; apply the institution's approved retention policy rather than silently deleting support history.

Rollback: disable the public recovery route before rolling back either auth backend. Do not drop the session-version column or private audit table. Removing version checks would revive old JWTs.
