import { supabase } from "../config/db.js";
import bcrypt from "bcryptjs";

// Helper: map Supabase user row to frontend-expected shape
function mapUser(row) {
  return {
    _id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleInitial: row.middle_initial,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: row.role_label,
    sections: row.sections,
    students: row.students,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: compute full name from parts
function computeName(firstName, middleInitial, lastName) {
  const mi = middleInitial ? ` ${middleInitial.toUpperCase().replace(/\./g, "")}.` : "";
  return `${firstName}${mi} ${lastName}`;
}

export const getTeachers = async (req, res) => {
  try {
    const { data: teachers, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "admin")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(teachers.map(mapUser));
  } catch (error) {
    console.error("Get teachers error:", error);
    res.status(500).json({ error: "Server error fetching teachers" });
  }
};

export const addTeacher = async (req, res) => {
  try {
    const { firstName, lastName, middleInitial, email } = req.body;
    if (!firstName || !lastName || !email) {
      return res.status(400).json({ error: "First name, last name, and email are required" });
    }

    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "Teacher with this email already exists" });
    }

    // Generate random 8-char password
    const generatedPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Get current student statistics to pre-populate the display counts
    const { data: studentsList } = await supabase.from("students").select("section");
    const uniqueSections = new Set((studentsList || []).map((s) => s.section));

    const name = computeName(firstName.trim(), middleInitial?.trim(), lastName.trim());

    const { data: newTeacher, error: insertError } = await supabase
      .from("users")
      .insert({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        middle_initial: middleInitial ? middleInitial.trim() : "",
        name,
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: "admin",
        role_label: "Grade 10 Teacher",
        sections: uniqueSections.size,
        students: (studentsList || []).length,
        status: "Invited",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Audit log
    await supabase.from("logs").insert({
      user: "Super Admin",
      action: "Create Teacher Account",
      details: `Created teacher account for ${firstName} ${lastName} (${email})`,
    });

    res.status(201).json({ ...mapUser(newTeacher), generatedPassword });
  } catch (error) {
    console.error("Add teacher error:", error);
    res.status(500).json({ error: "Server error creating teacher account" });
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: teacher, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !teacher || teacher.role !== "admin") {
      return res.status(404).json({ error: "Teacher not found" });
    }

    const { error: deleteError } = await supabase
      .from("users")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    // Audit log
    await supabase.from("logs").insert({
      user: "Super Admin",
      action: "Delete Teacher Account",
      details: `Removed teacher account for ${teacher.name} (${teacher.email})`,
    });

    res.json({ message: "Teacher account deleted successfully" });
  } catch (error) {
    console.error("Delete teacher error:", error);
    res.status(500).json({ error: "Server error deleting teacher account" });
  }
};
