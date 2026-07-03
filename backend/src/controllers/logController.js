import { supabase } from "../config/db.js";

// Helper: map row to frontend shape
function mapLog(row) {
  return {
    _id: row.id,
    user: row.user,
    action: row.action,
    details: row.details,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getLogs = async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from("logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    res.json(logs.map(mapLog));
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Server error fetching logs" });
  }
};

export const addLog = async (req, res) => {
  try {
    const { user, action, details } = req.body;
    if (!user || !action) {
      return res.status(400).json({ error: "User and action are required" });
    }

    const { data: log, error: insertError } = await supabase
      .from("logs")
      .insert({ user, action, details: details || "" })
      .select()
      .single();

    if (insertError) throw insertError;
    res.status(201).json(mapLog(log));
  } catch (error) {
    console.error("Add log error:", error);
    res.status(500).json({ error: "Server error creating audit log entry" });
  }
};
