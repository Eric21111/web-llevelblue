# Assessment and simulation evidence

## Enable uploads

1. Run `backend/migrations/20261008_learning_records.sql` in the shared Supabase project's SQL Editor. The migration is additive and repeatable; it does not rewrite students, BKT, feedback, saves, or unlocks.
2. Restart the Express web backend and the Python mobile API from `C:/Users/John Lloyd/OneDrive/Documents/level-blue/backend`.
3. Run or export the updated Godot project. Previously installed mobile builds do not send these events.
4. Verify with a temporary learner after migration: complete a pre-test, finish a lesson checkpoint or final-stage exam, finish/leave a stage, then confirm the records in the assigned teacher's diagnostics and the school head's School Progress page. Repeat a sync and confirm counts do not increase. Export both CSV and PDF.

The migration has been applied to the shared school database and verified through both live APIs. The opt-in integration run passed **38 checks**; see `learning-records-live-test-results.json`. Temporary learners and their evidence were removed, and before/after checksums confirmed existing students, BKT records, saves, and learning records were unchanged.

## What is recorded

- Pre-test completion with all answers present, a server-graded numerator/denominator, percentage, and question-bank fingerprint.
- Fully answered 25-question lesson checkpoints and 15-question stage exams, including zero scores. These scores are explicitly labeled **mobile-reported**. An exam can be completed even if the subsequent defense fails; exam completion and stage clearance are separate.
- Stage starts and terminal outcomes: cleared, failed, or abandoned. A start without a terminal result means **No result received**, including an app closed unexpectedly.
- Dated mastery observations from local BKT updates and completed pre-tests. Historical observations do not recalculate BKT or change campaign progression.
- Device event time and separate server receipt time. Device clocks are not independently verified. Dates without observations are omitted.

Guest/tutorial/preview activity and legacy saves do not manufacture learning history. Existing student IDs, mastery, campaign progress, and Codex unlocks are preserved.

## Offline delivery and access

`PlayerManager` stores pending events in its account-specific save. `SaveService` uploads batches of at most 100 using the existing authenticated sync request and HTTPRequest nodes. Events keep their UUIDs across retries/restarts. Only acknowledged events are removed locally; cloud snapshots never restore the pending queue. Account changes cancel in-flight requests. Pending evidence prevents a cloud fetch from overwriting local progress.

The mobile API binds records to the authenticated student ID, rejects staff accounts and inactive students, validates completion and ranges, and calls a server-only atomic database function. Duplicate uploads are harmless; conflicting reuse of an event ID fails without rewriting history. Anonymous/authenticated Supabase clients cannot read or write the table. Teacher reads and exports use the existing assigned-section checks; co-teachers share their assigned sections.

If ingestion fails, the API does not acknowledge events. The device retains its queue. Apply the migration before deploying the updated API/mobile build; new clients sending queued events receive a retryable error while the schema is unavailable. The queue drains on successful sync/retry. Legacy clients without events retain their existing save behavior.

## Staff views and reports

Teacher/head dashboards show assessment and attempt coverage. Diagnostics and reports show learner-level assessments, stage outcomes, and dated mastery. Both exports include the new evidence, its source, dates, and denominators; legacy scores are kept separate.

Clearance rate is **cleared attempts / finished attempts (cleared + failed)**. Abandoned and unfinished attempts are reported separately. Unique stages cleared is a distinct module/stage count, not program completion. Daily mastery means use each learner's last observation per topic/date and include the contributor count; changing participants means they are not a matched-cohort growth estimate.

## Learning-gain limitation

Matching percentage scales alone do not establish assessment comparability. The current pre-tests, lesson checkpoints, and stage exams have different instruments. New records therefore carry no approved comparison key, and their gains remain unavailable. The pairing implementation requires completed records for the same module, an explicitly approved matching comparison key and scale, and a post-test after its baseline; it uses the first eligible post-test rather than the best score. An academic review of the instruments is needed before assigning comparison keys. Program completion also remains unavailable until a required curriculum is defined.

## Verification

- 39 web/frontend tests passed, including section isolation, zero scores, comparable-pair rules, daily observation counts, exports, and migration preservation/permissions. The focused learning-record suite was rerun after export changes and passed all 4 tests.
- 24 focused mobile backend tests passed, including authenticated student binding, staff rejection, invalid/incomplete assessments, server grading, save compatibility, and failed-write behavior.
- Godot imported the updated scripts successfully; the memory-only learning-record suite passed 9 checks. The existing live-stage gameplay regression completed with `failures=0`.
- The frontend production build passed. Populated evidence was inspected with temporary fixture data at desktop and 390-pixel phone widths. The live head console correctly displayed the pending-migration message.
- Live Python mobile API → shared database → Express staff API verification passed 38 checks: event acknowledgements, idempotent retries, atomic conflicting-replay rollback, validation, source labels, zero scores, preserved saves/unlocks, assigned-section access, consistent risk/mastery evidence, individual and institutional CSV/PDF responses, and anonymous database/RPC denial. PDF checks here validate successful PDF responses; earlier layout checks are separate.
- The existing database student-status constraint does not allow `Inactive`, so this live runner does not change student lifecycle states. Inactive-student request rejection remains covered by the focused mobile unit tests. The first live test attempted this unsupported fixture status, was rejected by the constraint, and cleaned up successfully before the corrected run.
- Physical-phone gameplay and offline delivery through an installed updated build remain to be verified. No claim of physical-phone validation is made.

### Repeat the live integration check

Run `node tests/learning-records-live-smoke.mjs` from the web `backend` directory with both APIs running on ports 5000 and 8000. Set `LEVELBLUE_RUN_LIVE_LEARNING_TEST=1`, `SMOKE_TEACHER_EMAIL`, `SMOKE_HEAD_EMAIL`, and `SMOKE_STAFF_PASSWORD` in the process environment. The teacher must have a confirmed assigned section. Do not commit credentials. Run while existing learners are idle so preservation checksums can distinguish concurrent legitimate writes from test changes. The runner creates two random temporary learners and removes only their rows in `finally`; it writes a credential-free result file to `docs/learning-records-live-test-results.json`.

Exact GDScript additions/replacements are recorded, in application order, in `mobile-learning-records-gdscript.diff`. The changes are already applied to the mobile project; the diff is for review.
