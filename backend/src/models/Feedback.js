import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    teacherName: { type: String, default: "Anonymous" },
    rating: { type: Number, required: true },
    comments: { type: String, default: "" },
    q1: { type: Number, default: 4 },
    q2: { type: Number, default: 4 },
    q3: { type: Number, default: 4 },
    q4: { type: Number, default: 4 },
    q5: { type: Number, default: 4 }
  },
  { timestamps: true }
);

const Feedback = mongoose.model("Feedback", feedbackSchema);
export default Feedback;
