# Curriculum publishing and supplemental mobile resources

This milestone adds real teacher authoring, school-head review, and immutable published revisions. It does not change student enrollments, assessment scores, BKT, saved gameplay, or campaign Codex unlocks.

The exact additions and replacements to GDScript are recorded in [mobile-curriculum-gdscript.diff](mobile-curriculum-gdscript.diff). These changes are already applied to the mobile project; the diff is for review.

## Enable the feature

1. In the shared Supabase project, run `backend/migrations/20261008_curriculum.sql` after the two existing web-foundation migrations. The migration is additive and safe to run again; it creates curriculum tables and server-only functions. No existing learning data is rewritten. This new migration has been tested in an isolated PostgreSQL environment; it has **not** been applied to the live school database by this task.
2. Restart the Express web backend and the Python mobile API. Both must point to the same school's Supabase project, using their existing server-side service credentials. Never put the Supabase service key in Godot or a web bundle.
3. Run the updated Godot project at `C:/Users/John Lloyd/OneDrive/Documents/level-blue/frontend`, or export a new mobile build. Existing installed builds do not contain the reader.
4. For a physical phone, the Godot `levelblue/api_base_url` setting must reach the Python mobile API; `127.0.0.1` refers to the phone itself. Keep the web and mobile APIs' existing authentication configuration.
5. Smoke-test with an actual teacher draft and head review after migration, then sign in as a student and open **School Content** from Lessons or Codex. Refresh retrieves the latest published release. No real school content was published during automated verification.

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

The broader existing mobile Python suite has 11 failing assertions and 1 error in decision-scenario/trace-selector tests. The same 12 failures were reproduced from the unchanged committed baseline in an isolated temporary checkout. They are not introduced by this feature. Interactive web browser verification was unavailable because the browser automation runtime failed to start. Production database/mobile-device delivery remains pending the new migration and restart/rebuild steps above.

Promotion, broadcasts, assessment completion telemetry, and engagement oversight remain separate milestones.
