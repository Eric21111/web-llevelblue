import { supabase } from "../config/db.js";
import { CONTENT_SKILLS, countAuthoredBySkill } from "../utils/questionBank.js";
import { actorName } from "../utils/actor.js";

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
    const authoredBySkill = countAuthoredBySkill();
    const { data: items, error } = await supabase.from("content_bank").select("*");
    if (error && error.code !== "PGRST116" && error.code !== "42P01" && !(error.message && error.message.includes("does not exist"))) {
      throw error;
    }

    const dbBySkill = {};
    (items || []).forEach((row) => {
      if (row.skill) dbBySkill[row.skill] = row;
    });

    const merged = CONTENT_SKILLS.map((skill) => {
      const db = dbBySkill[skill];
      return mapItem({
        id: db?.id || skill.toLowerCase(),
        skill,
        authored: authoredBySkill[skill] || 0,
        validated: db?.validated ?? 0,
        target: db?.target ?? 40,
        created_at: db?.created_at || null,
        updated_at: db?.updated_at || null,
      });
    });

    res.json(merged);
  } catch (error) {
    console.error("Get content bank error:", error);
    res.status(500).json({ error: "Server error fetching content bank stats" });
  }
};

export const addContentBankItem = async (req, res) => {
  try {
    const { skill, validated, target } = req.body;
    if (!skill) {
      return res.status(400).json({ error: "Skill is required" });
    }

    const { data: existing } = await supabase
      .from("content_bank")
      .select("*")
      .ilike("skill", skill)
      .maybeSingle();

    if (existing) {
      const newValidated = existing.validated + (validated !== undefined ? Number(validated) : 0);
      const newTarget = target !== undefined ? Number(target) : existing.target;
      const { error: updateError } = await supabase
        .from("content_bank")
        .update({ validated: newValidated, target: newTarget })
        .eq("id", existing.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase.from("content_bank").insert({
        skill,
        authored: 0,
        validated: validated ? Number(validated) : 0,
        target: target ? Number(target) : 40,
      });
      if (insertError) throw insertError;
    }

    const actor = actorName(req, "Super Admin");

    await supabase.from("logs").insert({
      user: actor,
      action: "Update Content Bank",
      details: `Updated validation counts for skill ${skill}`,
    });

    return getContentBank(req, res);
  } catch (error) {
    console.error("Add content bank item error:", error);
    res.status(500).json({ error: "Server error updating content bank" });
  }
};
