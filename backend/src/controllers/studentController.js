import { supabase } from "../config/db.js";

// Helper: map a Supabase student row to the frontend-expected shape
function mapStudent(row) {
  return {
    _id: row.id,
    name: row.name,
    section: row.section,
    pre: row.pre,
    post: row.post,
    sessions: row.sessions,
    points: row.points,
    lastActive: row.last_active,
    technical: row.technical,
    status: row.status,
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
      Baiting: Number((postVal / 100 * (0.68 + Math.random() * 0.2)).toFixed(2)),
    };

    const { data: inserted, error: insertError } = await supabase
      .from("students")
      .insert({
        name,
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

    if (insertError) throw insertError;

    // Update teacher counts
    const { data: allStudents } = await supabase.from("students").select("section");
    const uniqueSections = new Set(allStudents.map((s) => s.section));

    await supabase
      .from("users")
      .update({ students: allStudents.length, sections: uniqueSections.size })
      .eq("role", "admin");

    // Audit log
    await supabase.from("logs").insert({
      user: "Teacher",
      action: "Add Student",
      details: `Added student ${name} to ${section}`,
    });

    res.status(201).json(mapStudent(inserted));
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

    // Update teacher counts
    const { data: allStudents } = await supabase.from("students").select("section");
    const uniqueSections = new Set(allStudents.map((s) => s.section));

    await supabase
      .from("users")
      .update({ students: allStudents.length, sections: uniqueSections.size })
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
