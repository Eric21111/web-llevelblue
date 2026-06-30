import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    section: { type: String, required: true },
    pre: { type: Number, default: 0 },
    post: { type: Number, default: 0 },
    sessions: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    lastActive: { type: String, default: "Just now" },
    technical: { type: Boolean, default: false },
    status: { type: String, default: "Needs Review", enum: ["On Track", "Needs Review", "At Risk"] },
    mastery: {
      Phishing: { type: Number, default: 0 },
      Smishing: { type: Number, default: 0 },
      Vishing: { type: Number, default: 0 },
      Pretexting: { type: Number, default: 0 },
      Baiting: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

const Student = mongoose.model("Student", studentSchema);
export default Student;
