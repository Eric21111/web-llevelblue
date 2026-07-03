import { supabase } from "../config/db.js";

// Map Database row to frontend shape
function mapSection(row) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject || "General Cybersecurity",
    createdAt: row.created_at,
  };
}

export const getSections = async (req, res) => {
  try {
    const { data: sections, error } = await supabase
      .from("sections")
      .select("*")
      .order("created_at", { ascending: false });

    // Fallback if table doesn't exist yet
    if (error) {
      if (error.code === "PGRST116" || error.code === "42P01" || (error.message && error.message.includes("does not exist"))) {
        console.warn("Sections table does not exist. Returning mock data.");
        return res.json([
          { id: "1", name: "Grade 10 - Gold", subject: "Cybersecurity Basics", createdAt: new Date() },
          { id: "2", name: "Grade 10 - Silver", subject: "Digital Literacy", createdAt: new Date() },
        ]);
      }
      throw error;
    }

    res.json((sections || []).map(mapSection));
  } catch (error) {
    console.error("Get sections error:", error);
    res.status(500).json({ error: "Server error fetching sections" });
  }
};

export const addSection = async (req, res) => {
  try {
    const { name, subject } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Section name is required" });
    }

    const { data: inserted, error } = await supabase
      .from("sections")
      .insert({ name, subject: subject || "General Cybersecurity" })
      .select()
      .single();

    if (error) throw error;

    // Audit log
    await supabase.from("logs").insert({
      user: "Teacher",
      action: "Create Section",
      details: `Created section/subject ${name} (${subject || "General Cybersecurity"})`,
    });

    res.status(201).json(mapSection(inserted));
  } catch (error) {
    console.error("Add section error:", error);
    res.status(500).json({ error: "Server error creating section" });
  }
};

export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing, error: findError } = await supabase
      .from("sections")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      return res.status(404).json({ error: "Section not found" });
    }

    const { error: deleteError } = await supabase
      .from("sections")
      .delete()
      .eq("id", id);

    if (deleteError) throw deleteError;

    // Audit log
    await supabase.from("logs").insert({
      user: "Teacher",
      action: "Delete Section",
      details: `Removed section ${existing.name}`,
    });

    res.json({ message: "Section deleted successfully" });
  } catch (error) {
    console.error("Delete section error:", error);
    res.status(500).json({ error: "Server error deleting section" });
  }
};
