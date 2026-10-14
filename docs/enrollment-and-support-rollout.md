# Enrollment and classroom support rollout

## Enable this release

1. Apply `backend/migrations/20261011_enrollment.sql` in the shared Supabase SQL Editor after the existing web-foundation migrations. The user applied this migration, and live verification passed on October 11, 2026. No additional enrollment migration is required for this release.
2. Restart the Express backend and the mobile Python API. Deploy the updated frontend and export an updated Godot build for the new attempt details. Existing mobile builds remain compatible with enrollment changes and basic learning events, but do not provide the new stage details.
3. Review teacher assignments before using **Section Checklist**. A teacher needs both source and destination assignments for promotion. A school head can operate across school sections.
4. Physical-phone testing is deferred at the user's request. Automated checks do not replace an installed-device acceptance test.

## Section Checklist

Both staff roles can select active learners, review their names, and confirm Grade 11 → Grade 12 promotion or Grade 12 graduation. Promotion selects an existing Grade 12 section and the next academic year. Graduation archives enrollment, removes learners from default active classroom summaries, and preserves mobile account access. This is enrollment archival, not account deactivation.

The server-only database transaction checks live staff status and assignments, grades, academic years, student versions, and outstanding mentor bounties. Resolve or cancel active bounties before moving their participants. A database insert guard prevents stale bounty requests from linking archived learners or learners in different sections.

Every batch records actor, time, source/destination grades and sections, and academic years. Missing historical years are not fabricated: the operator supplies the outgoing academic year for the first recorded transition. Subsequent transitions must match the stored year. Batch IDs make retries idempotent; stale selections fail atomically. Batches are limited to 500 learners.

Student IDs, scores, mastery, cloud saves, Codex unlocks, feedback, and learning evidence are preserved. Old section strings and IDs are changed together. The mobile progress endpoint only accepts an allowlist of student learning fields; it cannot write section, grade, academic year, or enrollment state. A database guard also rejects enrollment updates outside the checklist transaction.

**Learning Reports → Enrollment** includes active, graduated, and all authorized learners. A teacher's access follows current section assignments. Existing feedback and interventions keep their original section and remain subject to that section's access checks. This release does not provide arbitrary transfer, demotion, undo, or academic-year history from before the first recorded transition.

## Teacher Activity

School heads can filter 7/30/90 days and current section assignments. Counts use recorded review, remediation, bounty-review, and outcome-update events. Last recorded action is shown only when an event exists within the selected period. An empty count is labeled as no recorded activity, not proof of no work.

Open and student-confirmed bounty counts are current section totals shared by co-teachers. They are not attributed as an individual teacher's performance. Faculty reassignment changes the current section scope; this screen is not a historical faculty-assignment report.

## Failed-stage evidence

The existing mobile event queue now carries an optional bounded end-of-attempt snapshot. Shared quiz/combat scenes report phase, remaining base health, answer totals, defense waves, timeout occurrence, and up to 50 unique missed question IDs. Legacy LevelManager reports health/phase and available exam counts. Unsupported scene metrics are not inferred. These are mobile-reported observations, not independently verified failure diagnoses or full gameplay replays.

Staff expand **Inspect attempt** in learning evidence. PDF/CSV exports include available detail. The Python API rejects impossible counts, excessive question references, unexpected fields, and details attached to nonterminal events. Older events remain readable with an explicit missing-detail state.

Exact GDScript edits are in `mobile-support-rollout-gdscript.diff`; they are already applied to the mobile repository.

## Automated and UI verification

- 42 web/frontend tests passed. The final focused enrollment/evidence suites also passed after the bounty guard and export changes.
- 31 focused mobile-backend tests passed, including stale enrollment snapshots, bounded stage details, save compatibility, and learning-event validation.
- Godot import compiled the modified scripts. The 10 learning-record checks passed, including JSON round-trip preservation and valid zero values.
- The focused college final-assessment gameplay regression finished with `failures=0`. An earlier full gameplay run was interrupted during the chat pause; it is not counted as a completed full regression for this release.
- The new memory-only SaveService callback test passed 7 checks: offline/server failures, partial acknowledgement, events added during upload, old API responses, full acknowledgement, and account-switch cancellation. This uses production callback logic with in-memory persistence adapters; it does not emulate a physical network disconnect.
- The frontend production build passed. Temporary fixture pages exercised cohort selection/confirmation/success, mobile-width activity and evidence layouts, empty sections, and failed requests. Fixtures do not modify school records and are removed afterward.
- Local migration tests verify unchanged student IDs, mastery, unlocks, cloud saves, learning records, and feedback; atomic rollback, stale versions, duplicate batches, staff scope, anonymous denial, graduation, and stale mobile/bounty writes.
- Live verification passed 52 checks against the applied migration and both local APIs. It covered teacher promotion, school-head graduation, active-bounty blocking, foreign-section denial, authenticated-student and anonymous denial, duplicate retries, stale mobile snapshots, direct-write protection, teacher activity, detailed stage evidence, and archived PDF/CSV exports. Temporary learners and sections were removed. Before/after checksums matched for all 12 monitored tables. Results: `enrollment-live-test-results.json`.

### Repeat the live verification

Run `node tests/enrollment-live-smoke.mjs` from `backend`, with both APIs running on ports 5000 and 8000. Explicitly set `LEVELBLUE_RUN_LIVE_ENROLLMENT_TEST=1`, `SMOKE_HEAD_EMAIL`, `SMOKE_TEACHER_EMAIL`, and `SMOKE_STAFF_PASSWORD` in the process environment. The current runner expects the two staff test accounts to use that same password. Never commit these values. The runner creates temporary records and removes them in its cleanup block; ordinary login and feedback audit entries remain recorded.

The web and mobile APIs are independently configured for token signing. The runner authenticates separately with each API. Feedback endpoint verification therefore does not establish that a mobile API token is accepted by the web API, or that the phone's feedback UI delivers responses end to end.

## Device acceptance checklist (pending)

Use a disposable learner in an assigned Grade 11 test section and a Grade 12 destination. Record its ID, mastery, stage unlocks and Codex entries. Sign in using the updated build, complete an assessment and stage, then repeat with networking unavailable. Restart the app offline; reconnect and verify each event reaches the teacher view once. Switch accounts with an upload pending and verify isolation. After a staff promotion, sync an older local save and confirm the Grade 12 enrollment remains intact with unchanged ID/unlocks/history. Graduate the test learner and verify active roster exclusion and archived report availability.

The live migration and enrollment transitions have been verified using temporary learners. The installed physical-device flow remains pending. No real learners were promoted or archived during implementation or verification.
