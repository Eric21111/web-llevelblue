# Student feedback integration

The web page at `/survey` is a read-only viewer for teachers (`admin`) and school heads (`super`). The mobile app submits feedback with a signed-in student's bearer token. The mobile app source is not part of this repository.

## Database setup

Run `backend/migrations/20261007_student_feedback.sql` in the project's Supabase SQL editor before enabling student submissions. This additive migration preserves existing records, adds student/section/module metadata, and marks existing teacher/reviewer rows as `legacy`. No existing records are relabeled as student responses.

Until this migration is applied, the viewer can load but will not show legacy records, and student writes return HTTP 503 if the metadata columns are missing. This file and migration are prepared locally; they do not execute changes on the hosted database.

## Mobile submission

`POST /api/usability-feedback` with `Authorization: Bearer <student token>` and JSON:

```json
{
  "q1": 4,
  "q2": 4,
  "q3": 2,
  "q4": 4,
  "q5": 5,
  "module": "Baiting",
  "feedbackType": "bug",
  "comments": "The explanation button did not respond after the second question."
}
```

All five questions require integer ratings from 1 (strongly disagree) to 5 (strongly agree):

1. The game was easy to navigate.
2. I understood why my answers were wrong.
3. The difficulty felt right for me.
4. I would recommend this to a classmate.
5. The quizzes felt relevant to real scams.

`module` is optional; accepted names are Phishing, Smishing, Vishing, Pretexting, Baiting (case-insensitive). Omit it for general app feedback. `feedbackType` is optional (`comment`, the default, or `bug`). Comments are optional except for bug reports, with a maximum of 5,000 characters. Bug reports use the same five-question survey contract.

The server calculates the overall rating. The student's ID, name, and current section come from the authenticated account and database, never from the request body. Section is a snapshot at submission time. Teachers and school heads receive HTTP 403 if they try to submit. Invalid input returns HTTP 400; successful submission returns HTTP 201.

## Reading and summaries

`GET /api/usability-feedback` is available to teachers and school heads; students receive HTTP 403. It returns student submissions only, newest first, with `_id`, `studentId`, `studentName`, `respondentRole`, `section`, `module`, `feedbackType`, `rating`, `q1`–`q5`, `comments`, `createdAt`, and `updatedAt`.

The viewer refreshes every 30 seconds while visible. Section and module filters apply together to all summaries and comments. Overall satisfaction is the composite average of the five survey questions per response. Missing/invalid values do not count as zero. Difficulty fit is the average of q3, and low fit means a score of 1 or 2; it does not distinguish too easy from too hard. Bug labels use explicit `feedbackType`, not guesses from comment text.

Like the existing school dashboards, this API exposes available school records to staff. Section filters are a display feature, not a teacher-assignment permission boundary; the repository does not currently define that ownership mapping.
