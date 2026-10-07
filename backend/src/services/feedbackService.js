import { sectionScope, allRows } from './access.js';
const MODULES = ["Phishing", "Smishing", "Vishing", "Pretexting", "Baiting"];

export function validateStudentFeedback(body = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "A survey response object is required" };
  const scores = [body.q1, body.q2, body.q3, body.q4, body.q5];
  if (scores.some(value => (typeof value !== "number" && typeof value !== "string") || String(value).trim() === "" || !Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) {
    return { error: "All five survey ratings must be whole numbers from 1 to 5" };
  }
  const comments = body.comments ?? "";
  if (typeof comments !== "string" || comments.length > 5000) return { error: "Comments must be text of no more than 5,000 characters" };
  const moduleInput = body.module ?? "";
  if (typeof moduleInput !== "string") return { error: "Module must be a supported module name" };
  const module = MODULES.find(name => name.toLowerCase() === moduleInput.trim().toLowerCase()) || null;
  if (moduleInput.trim() && !module) return { error: "Choose Phishing, Smishing, Vishing, Pretexting, or Baiting; omit module for general feedback" };
  const feedbackType = body.feedbackType ?? "comment";
  if (!["comment", "bug"].includes(feedbackType)) return { error: "Feedback type must be comment or bug" };
  if (feedbackType === "bug" && !comments.trim()) return { error: "Describe the issue when submitting a bug report" };
  const numbers = scores.map(Number);
  return { value: { q1: numbers[0], q2: numbers[1], q3: numbers[2], q4: numbers[3], q5: numbers[4], rating: Number((numbers.reduce((a, b) => a + b, 0) / 5).toFixed(1)), comments: comments.trim(), module, feedback_type: feedbackType } };
}

export function mapFeedback(row) {
  return { _id: row.id, studentId: row.student_id, sectionId: row.section_id, studentName: row.student_name, respondentRole: row.respondent_role || "legacy", section: row.section || null, module: row.module || null, feedbackType: row.feedback_type || "comment", rating: row.rating, comments: row.comments, q1: row.q1, q2: row.q2, q3: row.q3, q4: row.q4, q5: row.q5, createdAt: row.created_at, updatedAt: row.updated_at };
}

export function createFeedbackHandlers(db) {
  return {
    getFeedback: async (req, res) => {
      if (!["admin", "super"].includes(req.user?.role) || req.user?.status !== "Active") return res.status(403).json({ error: "Student feedback can only be viewed by teachers and school heads" });
      try {
        const sections = await sectionScope(db,req.user,req.query || {});
        if(req.user.role === 'admin' && !sections.length) return res.json([]);
        let query = db.from('feedback').select('*');
        if(req.user.role === 'admin' || req.query?.sectionId || req.query?.grade) query = query.in('section_id',sections.map(s=>s.scope_id));
        const data = await allRows(query.order('created_at',{ascending:false}).order('id'));
        // Legacy teacher/reviewer responses must never be presented as student sentiment.
        res.json((data || []).filter(row => row.respondent_role === "student").map(mapFeedback));
      } catch (error) {
        if(!error.status) console.error("Get feedback error:", error);
        res.status(error.status || 503).json({ error: error.status ? error.message : "Could not load student feedback. Check the section migrations and retry." });
      }
    },
    addFeedback: async (req, res) => {
      if (req.user?.role !== "student") return res.status(403).json({ error: "Only students can submit feedback. Teachers and school heads have read-only access." });
      const validation = validateStudentFeedback(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });
      try {
        // Look up the current student record rather than trusting client-supplied identity or section.
        const { data: student, error: studentError } = await db.from("students").select("id, name, section, section_id").eq("id", req.user.id).maybeSingle();
        if (studentError) throw studentError;
        if (!student) return res.status(403).json({ error: "A current student account is required to submit feedback" });
        const { data: saved, error } = await db.from("feedback").insert({
          ...validation.value,
          respondent_role: "student", student_id: String(student.id), student_name: student.name,
          section: student.section || null, section_id: student.section_id || null,
          // Retain compatibility with the original required column; the viewer uses student_name.
          teacher_name: student.name,
        }).select().single();
        if (error) {
          if (["42703", "PGRST204"].includes(error.code)) return res.status(503).json({ error: "Student feedback storage is not configured yet. Please try again later." });
          throw error;
        }
        // An audit-log outage must not turn a successful submission into a retry/duplicate.
        try { await db.from("logs").insert({ user: student.name, action: "Student Feedback", details: `Submitted ${validation.value.module || "general app"} feedback` }); } catch (logError) { console.error("Feedback audit log error:", logError); }
        res.status(201).json(mapFeedback(saved));
      } catch (error) {
        console.error("Submit student feedback error:", error);
        res.status(500).json({ error: "Could not save student feedback" });
      }
    },
  };
}
