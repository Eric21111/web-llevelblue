import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    user: { type: String, required: true },
    action: { type: String, required: true },
    details: { type: String, default: "" }
  },
  { timestamps: true }
);

const Log = mongoose.model("Log", logSchema);
export default Log;
