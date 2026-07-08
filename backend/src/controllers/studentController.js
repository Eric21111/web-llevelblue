import { supabase } from "../config/db.js";
import bcrypt from "bcryptjs";

// BKT threshold constants
const BKT_AT_RISK_THRESHOLD = 0.40;  // P(L) below this → At-Risk
const BKT_EXCEL_THRESHOLD  = 0.90;  // P(L) at or above this → Excel

// Helper: compute Bayesian P(L) as average of all 5 mastery values
function computeBKT(row) {
  const vals = [
    row.mastery_phishing   ?? 0,
    row.mastery_smishing   ?? 0,
    row.mastery_vishing    ?? 0,
    row.mastery_pretexting ?? 0,
    row.mastery_baiting    ?? 0,
  ];
  const pL = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Number(pL.toFixed(3));
}

// Helper: derive status from BKT P(L)
function deriveStatus(pL) {
  if (pL < BKT_AT_RISK_THRESHOLD) return "At-Risk";
  if (pL < BKT_EXCEL_THRESHOLD)  return "Average";
  return "Excel";
}

// Helper: map a Supabase student row to the frontend-expected shape
function mapStudent(row) {
  const bkt = computeBKT(row);
  return {
    _id: row.id,
    name: row.name,
    email: row.email || null,
    section: row.section,
    pre: row.pre,
    post: row.post,
    sessions: row.sessions,
    points: row.points,
    lastActive: row.last_active,
    technical: row.technical,
    status: deriveStatus(bkt),
    bkt,
    mastery: {
      Phishing: row.mastery_phishing,
      Smishing: row.mastery_smishing,
      Vishing: row.mastery_vishing,
      Pretexting: row.mastery_pretexting,
      Baiting: row.mastery_baiting,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: compute full name from name parts
function computeName(firstName, middleName, lastName) {
  const mi = middleName ? ` ${middleName.trim().charAt(0).toUpperCase()}.` : "";
  return `${firstName.trim()}${mi} ${lastName.trim()}`;
}

export const getStudents = async (req, res) => {
  try {
    const { data: students, error } = await supabase
      .from("students")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(students.map(mapStudent));
  } catch (error) {
    console.error("Get students error:", error);
    res.status(500).json({ error: "Server error fetching students" });
  }
};

export const addStudent = async (req, res) => {
  try {
    const { firstName, lastName, middleName, email, section, technical } = req.body;
    if (!firstName || !lastName || !email || !section) {
      return res.status(400).json({ error: "First name, last name, email, and section are required" });
    }

    // Check for duplicate email in students table
    const { data: existingStudent } = await supabase
      .from("students")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existingStudent) {
      return res.status(400).json({ error: "A student with this email already exists" });
    }

    // Generate random 8-character temporary password
    const generatedPassword = Math.random().toString(36).slice(-8).toUpperCase();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const name = computeName(firstName, middleName, lastName);

    // Define initial analytics/score fallback values
    const preVal = Math.floor(Math.random() * 20) + 30;
    const postVal = Math.floor(Math.random() * 30) + 60;
    const sessionsVal = Math.floor(Math.random() * 15) + 5;
    const pointsVal = Math.floor(Math.random() * 1000) + 500;
    const techVal = !!technical;

    // Status will be recalculated dynamically via BKT in mapStudent
    const calcStatus = "On Track"; // valid value for DB constraint

    const defaultMastery = {
      Phishing: Number((postVal / 100 * (0.8 + Math.random() * 0.2)).toFixed(2)),
      Smishing: Number((postVal / 100 * (0.7 + Math.random() * 0.2)).toFixed(2)),
      Vishing: Number((postVal / 100 * (0.6 + Math.random() * 0.2)).toFixed(2)),
      Pretexting: Number((postVal / 100 * (0.75 + Math.random() * 0.2)).toFixed(2)),
      Baiting: Number((postVal / 100 * (0.68 + Math.random() * 0.2)).toFixed(2)),
    };

    // Insert student record with credentials stored directly in the students table
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        section,
        pre: preVal,
        post: postVal,
        sessions: sessionsVal,
        points: pointsVal,
        technical: techVal,
        status: calcStatus,
        mastery_phishing: defaultMastery.Phishing,
        mastery_smishing: defaultMastery.Smishing,
        mastery_vishing: defaultMastery.Vishing,
        mastery_pretexting: defaultMastery.Pretexting,
        mastery_baiting: defaultMastery.Baiting,
      })
      .select()
      .single();

    if (insertError) {
      // Detect missing columns — guide user to run the SQL migration
      if (insertError.code === "PGRST204" || (insertError.message && insertError.message.includes("email"))) {
        return res.status(500).json({
          error: "Database migration required. Run this SQL in your Supabase SQL Editor:",
          migration: [
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS password TEXT;",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS first_name TEXT;",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS last_name TEXT;",
            "ALTER TABLE students ADD COLUMN IF NOT EXISTS middle_initial TEXT;",
          ].join("\n"),
        });
      }
      throw insertError;
    }

    // Update teacher dashboard counts
    const { data: allStudents } = await supabase.from("students").select("section");
    const uniqueSections = new Set((allStudents || []).map((s) => s.section));

    await supabase
      .from("users")
      .update({ students: (allStudents || []).length, sections: uniqueSections.size })
      .eq("role", "admin");

    // Audit log
    await supabase.from("logs").insert({
      user: "Teacher",
      action: "Add Student",
      details: `Added student ${name} to ${section}`,
    });

    res.status(201).json({ ...mapStudent(inserted), generatedPassword });
  } catch (error) {
    console.error("Add student error:", error);
    res.status(500).json({ error: "Server error creating student" });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: student, error: findError } = await supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !student) {
      return res.status(404).json({ error: "Student not found" });
    }

    const { error: deleteError } = await supabase
      .from("students")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    // Update teacher dashboard counts
    const { data: allStudents } = await supabase.from("students").select("section");
    const uniqueSections = new Set((allStudents || []).map((s) => s.section));

    await supabase
      .from("users")
      .update({ students: (allStudents || []).length, sections: uniqueSections.size })
      .eq("role", "admin");

    // Audit log
    await supabase.from("logs").insert({
      user: "Teacher",
      action: "Delete Student",
      details: `Removed student ${student.name}`,
    });

    res.json({ message: "Student deleted successfully" });
  } catch (error) {
    console.error("Delete student error:", error);
    res.status(500).json({ error: "Server error deleting student" });
  }
};

export const getMentorsForStudent = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Get the at-risk student's details
    const { data: atRiskStudent, error: findError } = await supabase
      .from("students")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !atRiskStudent) {
      return res.status(404).json({ error: "Student not found" });
    }

    // 2. Identify failed topics (mastery < 0.40) from the student
    const failedTopics = [];
    if (atRiskStudent.mastery_phishing < 0.40) failedTopics.push("Phishing");
    if (atRiskStudent.mastery_smishing < 0.40) failedTopics.push("Smishing");
    if (atRiskStudent.mastery_vishing < 0.40) failedTopics.push("Vishing");
    if (atRiskStudent.mastery_pretexting < 0.40) failedTopics.push("Pretexting");
    if (atRiskStudent.mastery_baiting < 0.40) failedTopics.push("Baiting");

    if (failedTopics.length === 0) {
      return res.status(400).json({ error: "Student has no failed topics, mentor not needed." });
    }

    // 3. Query public.bkt_records for potential mentors (> 0.90 in those topics)
    // AND must be in the same section.
    // Since opt-in is not in the schema yet, we assume all students > 0.90 are eligible for now.
    const { data: bktRecords, error: bktError } = await supabase
      .from("bkt_records")
      .select("student_id, topic, probability_known");

    if (bktError) throw bktError;

    // 4. Get all students in the same section
    const { data: peers, error: peerError } = await supabase
      .from("students")
      .select("id, name, section")
      .eq("section", atRiskStudent.section)
      .neq("id", id);

    if (peerError) throw peerError;

    const mentors = [];

    peers.forEach(peer => {
      // Find if this peer has probability_known > 0.90 in ANY of the failed topics
      const peerBktRecords = bktRecords.filter(r => r.student_id === peer.id);
      
      const strongTopics = failedTopics.filter(topic => {
        const record = peerBktRecords.find(r => r.topic === topic);
        return record && record.probability_known > 0.90;
      });

      if (strongTopics.length > 0) {
        mentors.push({
          id: peer.id,
          name: peer.name,
          topics: strongTopics
        });
      }
    });

    if (mentors.length === 0) {
      return res.status(404).json({ error: "No eligible mentors found in this section." });
    }

    res.json({ mentors });

  } catch (error) {
    console.error("Get mentors error:", error);
    res.status(500).json({ error: "Server error assigning mentor" });
  }
};
