# Curriculum publishing and supplemental mobile resources

This milestone adds real teacher authoring, school-head review, and immutable published revisions. It does not change student enrollments, assessment scores, BKT, saved gameplay, or campaign Codex unlocks.

The exact additions and replacements to GDScript are recorded in [mobile-curriculum-gdscript.diff](mobile-curriculum-gdscript.diff). These changes are already applied to the mobile project; the diff is for review.

## Enable the feature

1. In the shared Supabase project, run `backend/migrations/20261008_curriculum.sql` after the two existing web-foundation migrations. The migration is additive and safe to run again; it creates curriculum tables and server-only functions. No existing learning data is rewritten. The user applied this migration; its catalog function and workflow were verified against the live school database on October 8, 2026.
2. Restart the Express web backend and the Python mobile API. Both must point to the same school's Supabase project, using their existing server-side service credentials. Never put the Supabase service key in Godot or a web bundle.
3. Run the updated Godot project at `C:/Users/John Lloyd/OneDrive/Documents/level-blue/frontend`, or export a new mobile build. Existing installed builds do not contain the reader.
4. For a physical phone, the Godot `levelblue/api_base_url` setting must reach the Python mobile API; `127.0.0.1` refers to the phone itself. Keep the web and mobile APIs' existing authentication configuration.
5. Smoke-test with an actual teacher draft and head review after migration, then sign in as a student and open **School Content** from Lessons or Codex. Refresh retrieves the latest published release. A clearly labeled temporary verification lesson was published during the live smoke test and then removed, together with its revisions, audit records, and temporary learner.

## Staff workflow

- Teachers: **My Teaching Content → New draft**. Choose Lesson, Practice question, or Threat Codex entry and one of the five threat topics. Save incomplete drafts; submission validates required text and quiz answers.
- School heads: **Review & Publish**. Filter by status/topic, inspect the teacher's content, then request changes with a note or approve. A separate publication confirmation makes the approved revision available in the student feed.
- Submitted/approved revisions are locked. Requested changes return editing access to the original teacher. Published content is immutable; **Create new revision** creates another draft while the previous publication remains available.
- A version check rejects stale edits/actions. One open revision per content item prevents conflicting drafts. Audit records retain actor IDs, action, note, and timestamps; staff history resolves actor names.
- School dashboards and notifications now show real submitted/approved/published states instead of the old question-count target editor. Teacher notifications identify returned drafts.

## Mobile behavior

The mobile repository adds `/api/content` to its existing FastAPI API. It verifies student authentication and current account existence/status, then calls the shared `levelblue_published_catalog` function. The web backend also exposes `/api/mobile/content` for its student authentication context. Both use the same database catalog and ETag format.

The catalog is a single database snapshot with `schemaVersion`, monotonically increasing `releaseVersion`, and the latest published revision per stable item ID. Drafts, review notes, author identity, and staff audit data are excluded. Publication is serialized so a newer release cannot commit ahead of an earlier in-flight release.

`ContentDB` owns one HTTPRequest child. Session changes load or clear resources; schema validation rejects malformed responses. The reader subscribes to `content_updated` and uses the existing screen router. Lessons and Codex offer a School Content entry point. Students can filter by topic/type, read resources, and try practice questions with immediate explanations.

School practice does not record grades, BKT updates, rewards, stage completions, or unlocks. Bundled gameplay content remains available offline. School resources are retained in memory during a transient failure in the same session; they are cleared on sign-out/account change. There is no persistent offline school-content cache in this release.

## Verification

Commands from the web repository:

```powershell
node --test backend/tests/*.test.js
node --test frontend/src/tests/*.test.js
npm run build --prefix frontend
```

From the mobile backend:

```powershell
python -m unittest discover -s tests -p test_school_content.py
```

Godot:

```text
--headless --path frontend --script res://src/tools/verify_school_content.gd
```

The Godot verification uses in-memory fixtures and checks schema validation, topic/type reading, wrong/correct practice answers, back navigation, sign-out clearing, and unchanged mastery/unlocks/progress. An optional `-- --render` captures desktop, landscape-phone, and portrait layouts under ignored `frontend/.godot/`.

Final results: 34 web tests passed, the Vite production build passed, all 4 mobile content API tests passed, and Godot School Content, Lessons (30 topics), and Codex (7 entries) verification scripts completed with zero failures. The new reader's rendered portrait and landscape layouts were inspected and its landscape controls adjusted to preserve reading space.

The broader existing mobile Python suite has 11 failing assertions and 1 error in decision-scenario/trace-selector tests. The same 12 failures were reproduced from the unchanged committed baseline in an isolated temporary checkout. They are not introduced by this feature. Browser verification subsequently succeeded on October 8, 2026: teacher login, draft save/submission, head approval, and explicit publication confirmation were exercised through the real UI. A real temporary student login retrieved the publication through the Python API, and the Godot client fetched and rendered it. All 21 live checks passed; see `curriculum-live-test-results.json`. Existing student and BKT records matched fresh before/after checksums after fixture cleanup. This used the local Godot runtime, not an installed physical-phone build. At the time of the curriculum test, the shared database lacked `player_saves` (PGRST205). The follow-up below resolves that separate cloud-save issue.

### Cloud-save follow-up (October 8, 2026)

The user subsequently applied `backend/migrations/20261008_player_saves.sql`. The table is now available. Live testing also uncovered an existing repeated-upload failure: BKT upserts defaulted to the record ID instead of the unique student/topic pair. The mobile backend's gameplay, assessment, and pre-test writers now explicitly use `on_conflict="student_id,topic"`.

All 17 focused Python save/mastery tests passed. All 21 live save checks passed; see `player-saves-live-test-results.json`. They cover initial upload, repeated updates, retrieval after a fresh login, zero values, retained pre-test flags and unlocks, one save per learner, BKT consistency, and anonymous/cross-account read restrictions. Temporary learners and their records were removed; existing students, BKT records, and saves matched their before/after checksums. Verification exercised the local mobile API against the shared database, not a physical-phone build. No further SQL is required for this fix.

To repeat this integration check, start the updated Python API on port 8000 and run from the web `backend` directory:

```powershell
$env:LEVELBLUE_RUN_LIVE_SAVE_TEST='1'
node tests/player-saves-live-smoke.mjs
```

Promotion, broadcasts, assessment completion telemetry, and engagement oversight remain separate milestones.

A UI issue found during testing was corrected: approval/publication responses now retain the teacher display name already loaded into the content list. The production build passed afterward.
