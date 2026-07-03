import { supabase } from "../config/db.js";

// Get a setting by key
export const getSetting = async (req, res) => {
  try {
    const { key } = req.params;
    
    const { data: setting, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", key)
      .single();

    // If setting doesn't exist or error, we can provide a fallback
    // For SIGNUP_SECURITY_KEY, fallback to default if missing (either not found or table doesn't exist yet)
    if (error && error.code !== "PGRST116" && error.code !== "42P01" && !(error.message && error.message.includes("does not exist"))) {
      throw error;
    }

    if (!setting && key === "SIGNUP_SECURITY_KEY") {
      return res.json({ value: "levelbluesecurity2026" });
    }

    res.json({ value: setting ? setting.value : "" });
  } catch (error) {
    console.error("Error fetching setting:", error);
    res.status(500).json({ error: "Server error while fetching setting" });
  }
};

// Update a setting
export const updateSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!value) {
      return res.status(400).json({ error: "Value is required" });
    }

    // First check if the setting exists, as upsert might need more config depending on Supabase version
    const { data: existing } = await supabase.from("settings").select("id").eq("key", key).single();

    let error;
    if (existing) {
      const res = await supabase.from("settings").update({ value }).eq("key", key);
      error = res.error;
    } else {
      const res = await supabase.from("settings").insert({ key, value });
      error = res.error;
    }

    if (error) throw error;

    // Log the change
    await supabase.from("logs").insert({
      user: "Super Admin",
      action: "Update Setting",
      details: `Updated setting for ${key}`,
    });

    res.json({ message: "Setting updated successfully" });
  } catch (error) {
    console.error("Error updating setting:", error);
    res.status(500).json({ error: "Server error while updating setting" });
  }
};
