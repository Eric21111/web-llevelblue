import { supabase } from "../config/db.js";

const DEFAULT_SKILLS = [
  { skill: "Phishing", authored: 0, validated: 0, target: 40 },
  { skill: "Smishing", authored: 0, validated: 0, target: 40 },
  { skill: "Vishing", authored: 0, validated: 0, target: 40 },
  { skill: "Pretexting", authored: 0, validated: 0, target: 40 },
  { skill: "Baiting", authored: 0, validated: 0, target: 40 },
];

// Helper: map row to frontend shape
function mapItem(row) {
  return {
    _id: row.id,
    skill: row.skill,
    authored: row.authored,
    validated: row.validated,
    target: row.target,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const getContentBank = async (req, res) => {
  try {
    let { data: items, error } = await supabase.from("content_bank").select("*");
    if (error) throw error;

    // Seed default skills if empty
    if (!items || items.length === 0) {
      const { error: seedError } = await supabase.from("content_bank").insert(DEFAULT_SKILLS);
      if (seedError) throw seedError;

      const { data: seeded } = await supabase.from("content_bank").select("*");
      items = seeded;
    }

    res.json(items.map(mapItem));
  } catch (error) {
    console.error("Get content bank error:", error);
    res.status(500).json({ error: "Server error fetching content bank stats" });
  }
};

export const addContentBankItem = async (req, res) => {
  try {
    const { skill, authored, validated, target } = req.body;
    if (!skill) {
      return res.status(400).json({ error: "Skill is required" });
    }

    // Case-insensitive search for existing skill
    const { data: existing } = await supabase
      .from("content_bank")
      .select("*")
      .ilike("skill", skill)
      .single();

    if (existing) {
      const newAuthored = existing.authored + (authored !== undefined ? Number(authored) : 0);
      const newValidated = existing.validated + (validated !== undefined ? Number(validated) : 0);
      const newTarget = target !== undefined ? Number(target) : existing.target;

      const { error: updateError } = await supabase
        .from("content_bank")
        .update({ authored: newAuthored, validated: newValidated, target: newTarget })
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("content_bank").insert({
        skill,
        authored: authored ? Number(authored) : 0,
        validated: validated ? Number(validated) : 0,
        target: target ? Number(target) : 40,
      });
      if (insertError) throw insertError;
    }

    // Audit log
    await supabase.from("logs").insert({
      user: "Super Admin",
      action: "Update Content Bank",
      details: `Updated items for skill ${skill}`,
    });

    const { data: updatedBank } = await supabase.from("content_bank").select("*");
    res.json(updatedBank.map(mapItem));
  } catch (error) {
    console.error("Add content bank item error:", error);
    res.status(500).json({ error: "Server error updating content bank" });
  }
};
