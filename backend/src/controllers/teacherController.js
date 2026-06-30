import User from "../models/User.js";
import Student from "../models/Student.js";
import Log from "../models/Log.js";

export const getTeachers = async (req, res) => {
  try {
    // Find all users with the role of admin (teachers)
    const teachers = await User.find({ role: "admin" }).sort({ createdAt: -1 });
    res.json(teachers);
  } catch (error) {
    console.error("Get teachers error:", error);
    res.status(500).json({ error: "Server error fetching teachers" });
  }
};

export const addTeacher = async (req, res) => {
  try {
    const { firstName, lastName, middleInitial, email, password } = req.body;
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ error: "Teacher with this email already exists" });
    }

    // Get current student statistics to pre-populate the display counts
    const studentsList = await Student.find({});
    const uniqueSections = new Set(studentsList.map(s => s.section));

    const newTeacher = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleInitial: middleInitial ? middleInitial.trim() : "",
      email: email.toLowerCase().trim(),
      password: password || "password123",
      role: "admin",
      roleLabel: "Grade 10 Teacher",
      sections: uniqueSections.size,
      students: studentsList.length,
      status: "Active"
    });

    await newTeacher.save();

    // Audit log
    const auditLog = new Log({
      user: "Super Admin",
      action: "Create Teacher Account",
      details: `Created teacher account for ${firstName} ${lastName} (${email})`,
    });
    await auditLog.save();

    res.status(201).json(newTeacher);
  } catch (error) {
    console.error("Add teacher error:", error);
    res.status(500).json({ error: "Server error creating teacher account" });
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;
    const teacher = await User.findById(id);
    if (!teacher || teacher.role !== "admin") {
      return res.status(404).json({ error: "Teacher not found" });
    }

    await User.findByIdAndDelete(id);

    // Audit log
    const auditLog = new Log({
      user: "Super Admin",
      action: "Delete Teacher Account",
      details: `Removed teacher account for ${teacher.name} (${teacher.email})`,
    });
    await auditLog.save();

    res.json({ message: "Teacher account deleted successfully" });
  } catch (error) {
    console.error("Delete teacher error:", error);
    res.status(500).json({ error: "Server error deleting teacher account" });
  }
};
