import { supabase } from "../config/db.js";

const DEFAULT_FEEDBACK = [
  { teacher_name: "John Lloyd Climaco", rating: 4.4, comments: "Students love the game and learn phishing indicators fast.", q1: 5, q2: 4, q3: 4, q4: 5, q5: 4, created_at: "2026-06-29T10:00:00Z" },
  { teacher_name: "Eric Libradilla Jr.", rating: 4.4, comments: "The rapid fire mode is very effective.", q1: 4, q2: 5, q3: 4, q4: 4, q5: 5, created_at: "2026-06-29T10:15:00Z" },
  { teacher_name: "Marjouk Ellih", rating: 4.0, comments: "The UI design is top notch, very responsive.", q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, created_at: "2026-06-29T10:30:00Z" },
];

// Helper: map row to frontend shape
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

export const getFeedback = async (req, res) => {
  try {
    let { data: items, error } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Seed initial feedbacks if empty
    if (!items || items.length === 0) {
      const { error: seedError } = await supabase.from("feedback").insert(DEFAULT_FEEDBACK);
      if (seedError) throw seedError;

      const { data: seeded } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      items = seeded;
    }

    res.json(items.map(mapFeedback));
  } catch (error) {
    console.error("Get feedback error:", error);
    res.status(500).json({ error: "Server error fetching feedback" });
  }
};

export const addFeedback = async (req, res) => {
  try {
    const { teacherName, rating, comments, q1, q2, q3, q4, q5 } = req.body;
    if (rating === undefined) {
      return res.status(400).json({ error: "Rating is required" });
    }

    const { data: newFeedback, error: insertError } = await supabase
      .from("feedback")
      .insert({
        teacher_name: teacherName || "Anonymous",
        rating: Number(rating),
        comments: comments || "",
        q1: q1 ? Number(q1) : 4,
        q2: q2 ? Number(q2) : 4,
        q3: q3 ? Number(q3) : 4,
        q4: q4 ? Number(q4) : 4,
        q5: q5 ? Number(q5) : 4,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log feedback action
    await supabase.from("logs").insert({
      user: teacherName || "Teacher",
      action: "Submit Feedback",
      details: `Submitted usability rating: ${rating}/5`,
    });

    res.status(201).json(mapFeedback(newFeedback));
  } catch (error) {
    console.error("Add feedback error:", error);
    res.status(500).json({ error: "Server error creating feedback entry" });
  }
};
