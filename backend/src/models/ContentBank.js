import mongoose from "mongoose";

const contentBankSchema = new mongoose.Schema(
  {
    skill: { type: String, required: true, unique: true },
    authored: { type: Number, default: 0 },
    validated: { type: Number, default: 0 },
    target: { type: Number, default: 40 }
  },
  { timestamps: true }
);

const ContentBank = mongoose.model("ContentBank", contentBankSchema);
export default ContentBank;
