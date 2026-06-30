import Feedback from "../models/Feedback.js";
import Log from "../models/Log.js";

const DEFAULT_FEEDBACK = [
  { teacherName: "John Lloyd Climaco", rating: 4.4, comments: "Students love the game and learn phishing indicators fast.", q1: 5, q2: 4, q3: 4, q4: 5, q5: 4, createdAt: new Date("2026-06-29T10:00:00Z") },
  { teacherName: "Eric Libradilla Jr.", rating: 4.4, comments: "The rapid fire mode is very effective.", q1: 4, q2: 5, q3: 4, q4: 4, q5: 5, createdAt: new Date("2026-06-29T10:15:00Z") },
  { teacherName: "Marjouk Ellih", rating: 4.0, comments: "The UI design is top notch, very responsive.", q1: 4, q2: 4, q3: 4, q4: 4, q5: 4, createdAt: new Date("2026-06-29T10:30:00Z") }
];

export const getFeedback = async (req, res) => {
  try {
    let items = await Feedback.find({}).sort({ createdAt: -1 });
    
    // Seed initial feedbacks if empty
    if (items.length === 0) {
      await Feedback.insertMany(DEFAULT_FEEDBACK);
      items = await Feedback.find({}).sort({ createdAt: -1 });
    }
    
    res.json(items);
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

    const newFeedback = new Feedback({
      teacherName: teacherName || "Anonymous",
      rating: Number(rating),
      comments: comments || "",
      q1: q1 ? Number(q1) : 4,
      q2: q2 ? Number(q2) : 4,
      q3: q3 ? Number(q3) : 4,
      q4: q4 ? Number(q4) : 4,
      q5: q5 ? Number(q5) : 4
    });

    await newFeedback.save();

    // Log feedback action
    const auditLog = new Log({
      user: teacherName || "Teacher",
      action: "Submit Feedback",
      details: `Submitted usability rating: ${rating}/5`,
    });
    await auditLog.save();

    res.status(201).json(newFeedback);
  } catch (error) {
    console.error("Add feedback error:", error);
    res.status(500).json({ error: "Server error creating feedback entry" });
  }
};
