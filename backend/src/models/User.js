import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    middleInitial: { type: String, default: "", trim: true, maxLength: 1 },
    name: { type: String },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, required: true, enum: ["admin", "super"] },
    roleLabel: { type: String, required: true },
    sections: { type: Number, default: 0 },
    students: { type: Number, default: 0 },
    status: { type: String, default: "Active", enum: ["Active", "Invited"] },
  },
  { timestamps: true }
);

// Pre-save hook to compute the full name field dynamically
userSchema.pre("save", function () {
  const mi = this.middleInitial ? ` ${this.middleInitial.toUpperCase().replace(/\./g, "")}.` : "";
  this.name = `${this.firstName}${mi} ${this.lastName}`;
});

const User = mongoose.model("User", userSchema);
export default User;
