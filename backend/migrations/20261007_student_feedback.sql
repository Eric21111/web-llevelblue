-- Run once in the project's Supabase SQL editor before enabling mobile feedback.
-- Existing teacher/reviewer rows remain intact and are excluded from student summaries.
BEGIN;
ALTER TABLE public.feedback
  ADD COLUMN IF NOT EXISTS respondent_role text NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS student_id text,
  ADD COLUMN IF NOT EXISTS student_name text,
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS feedback_type text NOT NULL DEFAULT 'comment';
CREATE INDEX IF NOT EXISTS feedback_student_created_idx
  ON public.feedback (created_at DESC) WHERE respondent_role = 'student';
COMMIT;
NOTIFY pgrst, 'reload schema';
