import Student from "../models/Student.js";
import User from "../models/User.js";
import Log from "../models/Log.js";

export const getStudents = async (req, res) => {
  try {
    const students = await Student.find({}).sort({ createdAt: -1 });
    res.json(students);
  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({ error: "Server error fetching students" });
  }
};

export const addStudent = async (req, res) => {
  try {
    const { name, section, pre, post, sessions, points, technical, status, mastery } = req.body;
    if (!name || !section) {
      return res.status(400).json({ error: "Name and section are required" });
    }

    const preVal = pre !== undefined ? Number(pre) : Math.floor(Math.random() * 20) + 30;
    const postVal = post !== undefined ? Number(post) : Math.floor(Math.random() * 30) + 60;
    const sessionsVal = sessions !== undefined ? Number(sessions) : Math.floor(Math.random() * 15) + 5;
    const pointsVal = points !== undefined ? Number(points) : Math.floor(Math.random() * 1000) + 500;
    const techVal = !!technical;

    let calcStatus = status;
    if (!calcStatus) {
      if (postVal >= 80) calcStatus = "On Track";
      else if (postVal >= 60) calcStatus = "Needs Review";
      else calcStatus = "At Risk";
    }

    const defaultMastery = mastery || {
      Phishing: Number((postVal / 100 * (0.8 + Math.random() * 0.2)).toFixed(2)),
      Smishing: Number((postVal / 100 * (0.7 + Math.random() * 0.2)).toFixed(2)),
      Vishing: Number((postVal / 100 * (0.6 + Math.random() * 0.2)).toFixed(2)),
      Pretexting: Number((postVal / 100 * (0.75 + Math.random() * 0.2)).toFixed(2)),
      Baiting: Number((postVal / 100 * (0.68 + Math.random() * 0.2)).toFixed(2))
    };

    const newStudent = new Student({
      name,
      section,
      pre: preVal,
      post: postVal,
      sessions: sessionsVal,
      points: pointsVal,
      technical: techVal,
      status: calcStatus,
      mastery: defaultMastery
    });

    await newStudent.save();

    // Update teacher counts in MongoDB
    const studentsList = await Student.find({});
    const uniqueSections = new Set(studentsList.map(s => s.section));
    
    // Update all users who are teachers
    await User.updateMany(
      { role: "admin" },
      { 
        $set: { 
          students: studentsList.length,
          sections: uniqueSections.size
        } 
      }
    );

    // Audit log
    const auditLog = new Log({
      user: "Teacher",
      action: "Add Student",
      details: `Added student ${name} to ${section}`,
    });
    await auditLog.save();

    res.status(201).json(newStudent);
  } catch (error) {
    console.error("Add student error:", error);
    res.status(500).json({ error: "Server error creating student" });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ error: "Student not found" });
    }

    await Student.findByIdAndDelete(id);

    // Update teacher counts in MongoDB
    const studentsList = await Student.find({});
    const uniqueSections = new Set(studentsList.map(s => s.section));
    
    await User.updateMany(
      { role: "admin" },
      { 
        $set: { 
          students: studentsList.length,
          sections: uniqueSections.size
        } 
      }
    );

    // Audit log
    const auditLog = new Log({
      user: "Teacher",
      action: "Delete Student",
      details: `Removed student ${student.name}`,
    });
    await auditLog.save();

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ error: "Server error deleting student" });
  }
};
