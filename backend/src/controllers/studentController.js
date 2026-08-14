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

// Helper: derive display status from BKT P(L) — API only, not written to DB.
function deriveStatus(pL) {
  if (pL < BKT_AT_RISK_THRESHOLD) return "At Risk";
  if (pL < BKT_EXCEL_THRESHOLD) return "On Track";
  return "On Track";
}

// Helper: map a Supabase student row to the frontend-expected shape
function mapStudent(row) {
  const bkt = computeBKT(row);
  const isFresh = Number(row.sessions ?? 0) === 0 && Number(row.pre ?? 0) === 0;
  return {
    _id: row.id,
    name: row.name,
    email: row.email || null,
    section: row.section,
    pre: Number(row.pre) || 0,
    post: Number(row.post) || 0,
    sessions: Number(row.sessions) || 0,
    points: Number(row.points) || 0,
    lastActive: row.last_active,
    technical: row.technical,
    status: isFresh ? (row.status || "Needs Review") : deriveStatus(bkt),
    bkt,
    mastery: {
      Phishing: Number(row.mastery_phishing) || 0,
      Smishing: Number(row.mastery_smishing) || 0,
      Vishing: Number(row.mastery_vishing) || 0,
      Pretexting: Number(row.mastery_pretexting) || 0,
      Baiting: Number(row.mastery_baiting) || 0,
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
    const techVal = !!technical;

    // Fresh accounts start empty — no dummy scores or mastery.
    // Pre-test on the mobile app writes real BKT P(L) and the pre score.
    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({
        name,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_initial: middleName ? middleName.trim().charAt(0).toUpperCase() : null,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        requires_password_change: true,
        section,
        pre: 0,
        post: 0,
        sessions: 0,
        points: 0,
        technical: techVal,
        status: "Needs Review",
        mastery_phishing: 0,
        mastery_smishing: 0,
        mastery_vishing: 0,
        mastery_pretexting: 0,
        mastery_baiting: 0,
      })
      .select()
      .single();

    if (insertError) {
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
