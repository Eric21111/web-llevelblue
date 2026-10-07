# LEVELBLUE web foundations — first release

This release supports one school, Grades 11–12 and multiple teachers per section. Roles remain `super` (school head), `admin` (teacher), and `student` (mobile).

## Deployment order

1. Back up the school database and apply migrations to a staging copy first. Run `backend/migrations/20261007_student_feedback.sql`, then `backend/migrations/20261007_web_foundations.sql` in the Supabase SQL editor. Both are additive and repeatable. They have been tested in an isolated PostgreSQL-compatible database, **not applied to the connected school database by this implementation**.
2. Configure the backend-only `SUPABASE_SERVICE_KEY` alongside the existing Supabase URL, anon key and JWT secret. The service key must never be included in frontend variables or mobile builds. New staff tables have RLS enabled and no anon/authenticated grants.
3. Review unresolved enrollment using the queries below. Section IDs are copied from existing `sections.id` into a unique text `scope_id`, avoiding assumptions about the original primary-key type. Student and feedback rows receive a `section_id` only for an unambiguous section-name match. Existing names and records are preserved. Confirm legacy section grades in **Sections**; do not guess grades from names.
4. As school head, use **Teacher Accounts → Faculty access & section assignments** to select each teacher's sections and status. No assignments are inferred from previously school-wide numeric counts. Teachers see no students until assigned. Co-teachers receive the same section access. New sections created by teachers assign their creator atomically.
5. Restart the existing backend process after deploying. Do not start a second backend on port 5000. Run `npm run build --prefix frontend`, `npm test --prefix backend`, and `node --test frontend/src/tests/*.test.js`.
6. Before release, verify an actual teacher, co-teacher and head session against the migrated staging database, including PDF downloads. The isolated route tests and browser fixture do not establish mobile compatibility or production deployment.

```sql
-- Resolve these manually with the school head before granting teachers access.
select id, name from sections where grade_level is null;
select name, count(*) from sections group by name having count(*) > 1;
select id, section, grade_level from students where section_id is null;
select id, section from feedback where respondent_role = 'student' and section_id is null;
```

Do not rename duplicate mobile-facing section names or backfill ambiguous enrollment without verifying which section owns each record. Unknown enrollment is available only to the school head's unfiltered school view. Existing student IDs, scores, mastery columns, saves, codex unlocks, and feedback history are not reset. Deletion endpoints reject destructive removal of teachers, sections and students; use faculty deactivation now, and cohort archival when its mobile contract is verified.

Grade confirmation accepts missing legacy student grades (null or blank). The workspace then uses the confirmed section grade for those learners' display and grade filters without rewriting student records. An explicitly recorded different student grade still blocks confirmation, as does changing an already confirmed section to a different grade. Select a grade and use **Confirm section grade**; selecting an option alone does not save it.

## Staff workflows and API

All workspace routes validate the live staff account and role, then authorize the requested section or student. Changing a URL, student ID, grade or export filter cannot expand a teacher's scope. Inactive accounts cannot use previously issued tokens. Reactivating a suspended invitation restores `Invited` so the first-password-change requirement cannot be bypassed.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/teachers` | Head-only faculty list, assignment-derived counts and grades |
| `POST /api/teachers` | Head-only teacher invitation and temporary credentials |
| `PATCH /api/teachers/:id` | Head-only `{status, sectionIds}`; assignments/status and audit event saved atomically |
| `GET /api/sections` | Authorized sections, stable `id`, `gradeLevel`, preserved name |
| `POST /api/sections` | `{name, gradeLevel, subject?}`; teacher creator is assigned automatically |
| `PATCH /api/sections/:id` | Head confirms `{gradeLevel}` if existing enrollment agrees; not a promotion API |
| `GET /api/students` | Authorized roster using canonical mastery |
| `GET /api/analytics` | Same roster, topic coverage, support proportions, section and grade comparisons |
| `GET /api/analytics/at-risk` | Learners with at least one recorded topic below 0.40 |
| `GET /api/interventions` | Scoped review/remediation history; optional `studentId` |
| `POST /api/interventions` | `{studentId, kind, topic, note, scheduledDate?, outcome?, bountyId?}` |
| `PATCH /api/interventions/:id` | Update `{outcome}` with a separate audit event |
| `GET /api/reports/institutional` | Head-only PDF or CSV, authorized grade/section filters |
| `GET /api/reports/individual` | Staff export for authorized `studentId` |

Analytics, roster, interventions, feedback and reports accept `sectionId` and/or `grade=Grade 11|Grade 12`. Export format is `format=pdf|csv`. Invalid or unauthorized filters fail rather than returning school-wide data. CSV cells are quoted and protected against spreadsheet formula interpretation. Reports identify their scope, generated UTC timestamp, learner/feedback counts, confirmed tests, comparable pairs, per-topic mastery and recorded interventions. Large datasets are paginated rather than silently truncated at the Supabase page limit.

Intervention kinds: `review`, `remediation`, `bounty-review`. All require a supported topic and note. Remediation also requires a scheduled date. Outcomes: `Pending`, `In progress`, `Completed`, `Follow-up needed`. The `staff_events` table retains actor IDs, timestamps and snapshots for assignment changes and intervention actions; the intervention retains its original `actor_id` and records subsequent editors in `updated_by`. This is documented activity, not a teacher-performance score.

## Evidence rules

- `bkt_records` is authoritative per student/topic. A recorded zero is assessed. Latest dated observations take precedence. Conflicting undated observations are unassessed because their order is unknown. Without a BKT observation, positive legacy mastery is displayed; default legacy zero columns remain unassessed. Unassessed values are excluded from averages and support denominators.
- Risk, mentor eligibility, dashboards, diagnostics and exports use the same service. A support flag means recorded BKT below 0.40 in any topic. Mentor eligibility requires above 0.90 for the requested topic, the same section, and a different student. BKT is an estimate, not quiz accuracy, a failed stage, or a simulation-clearance record.
- Positive legacy test scores remain visible but unconfirmed. A zero score is displayed as a test result only when completion is established. Missing tests are never substituted with zero.
- Gains require `pre_completed_at`, `post_completed_at`, equal nonempty `pre_scale` / `post_scale`, and equal nonempty `pre_assessment_pair_id` / `post_assessment_pair_id`, with post completion at or after pre completion. Pair IDs identify an actual paired assessment occasion. Scale IDs must describe comparable instrument/version and scoring maximum; matching numeric-looking scores alone is not enough. Nothing backfills completion or pairing from a positive score or session count. A future trusted mobile ingestion path must establish this metadata.
- Missing schema/data sources produce errors rather than plausible zero totals. Institutional exports present learning evidence and do not certify accreditation.

## Existing mobile bounty contract

Student endpoints keep their paths: `/api/bounties/student/:id`, `/mentee-code/:id`, `/:id/accept`, `/:id/verify-otp`, `/:id/validate`, `/:id/self-clear`.

Only the mentor can accept and verify the code. Only the mentee can retrieve that code and confirm/deny mentoring after acceptance. List/mutation responses omit the code. OTP attempts are rate limited. Staff can assign eligible mentors, cancel without erasing confirmation history, and add a separate bounty review. `POST /api/bounties` now returns an array, one record per requested topic; the web roster handles this. Cancelled records expose `cancelled_at` and retain the original status/confirmation. Mobile consumers must hide/disable cancelled records and handle current authorization/state errors before this change is released with the app.

## Explicitly pending

Promotion/academic-year enrollment, graduation archival, versioned curriculum draft/review/publishing, mobile home announcements, failed-stage inspection, confirmed simulation clearance/completion, dated mastery trends and teacher oversight screens are not implemented in this phase. The missing mobile repository/data pipeline prevents an end-to-end compatibility claim. Historical-looking charts and mastery-as-accuracy screens have been replaced in active navigation by recorded diagnostics and reports.

## Validation completed / remaining

Automated tests cover section ID/filter/export authorization, co-teachers, student/staff roles, live-token deactivation, missing/zero mastery and scores, paired gains, interventions, bounty participants and state transitions, CSV escaping, PDF generation, and repeatable additive migration preservation. Browser testing uses isolated synthetic records for desktop/mobile layout, keyboard review submission, failure and empty states. Apply to staging and test against the actual Supabase schema and mobile client before production release.
