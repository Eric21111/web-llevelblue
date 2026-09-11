import { supabase } from "../config/db.js";
import { actorName } from "../utils/actor.js";

function mapFeedback(row) {
  return {
    _id: row.id,
    teacherName: row.teacher_name,
    rating: row.rating,
    comments: row.comments,
    q1: row.q1,
    q2: row.q2,
    q3: row.q3,
    q4: row.q4,
    q5: row.q5,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function submitterName(req) {
  return actorName(req, "Teacher");
}

export const getFeedback = async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json((items || []).map(mapFeedback));
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({ error: "Server error fetching feedback" });
  }
};

export const addFeedback = async (req, res) => {
  try {
    const { rating, comments, q1, q2, q3, q4, q5 } = req.body;
    const scores = [q1, q2, q3, q4, q5].map(Number);
    if (scores.some((n) => !Number.isFinite(n) || n < 1 || n > 5)) {
      return res.status(400).json({ error: "All five ratings (1–5) are required" });
    }
    if (rating === undefined) {
      return res.status(400).json({ error: "Rating is required" });
    }

    const teacherName = submitterName(req);

    const { data: newFeedback, error: insertError } = await supabase
      .from("feedback")
      .insert({
        teacher_name: teacherName,
        rating: Number(rating),
        comments: comments || "",
        q1: scores[0],
        q2: scores[1],
        q3: scores[2],
        q4: scores[3],
        q5: scores[4],
      })
      .select()
      .single();

    if (insertError) throw insertError;

    await supabase.from("logs").insert({
      user: teacherName,
      action: "Submit Feedback",
      details: `Submitted usability rating: ${rating}/5`,
    });

    res.status(201).json(mapFeedback(newFeedback));
  } catch (error) {
    console.error("Add feedback error:", error);
    res.status(500).json({ error: "Server error creating feedback entry" });
  }
};
