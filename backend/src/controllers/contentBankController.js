import ContentBank from "../models/ContentBank.js";
import Log from "../models/Log.js";

const DEFAULT_SKILLS = [
  { skill: "Phishing", authored: 0, validated: 0, target: 40 },
  { skill: "Smishing", authored: 0, validated: 0, target: 40 },
  { skill: "Vishing", authored: 0, validated: 0, target: 40 },
  { skill: "Pretexting", authored: 0, validated: 0, target: 40 },
  { skill: "Baiting", authored: 0, validated: 0, target: 40 }
];

export const getContentBank = async (req, res) => {
  try {
    let items = await ContentBank.find({});
    
    // Seed default skills if empty
    if (items.length === 0) {
      await ContentBank.insertMany(DEFAULT_SKILLS);
      items = await ContentBank.find({});
    }
    
    res.json(items);
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

    const item = await ContentBank.findOne({ skill: { $regex: new RegExp(`^${skill}$`, "i") } });
    if (item) {
      item.authored += authored !== undefined ? Number(authored) : 0;
      item.validated += validated !== undefined ? Number(validated) : 0;
      if (target !== undefined) item.target = Number(target);
      await item.save();
    } else {
      const newItem = new ContentBank({
        skill,
        authored: authored ? Number(authored) : 0,
        validated: validated ? Number(validated) : 0,
        target: target ? Number(target) : 40
      });
      await newItem.save();
    }

    // Audit log
    const auditLog = new Log({
      user: "Super Admin",
      action: "Update Content Bank",
      details: `Updated items for skill ${skill}`,
    });
    await auditLog.save();

    const updatedBank = await ContentBank.find({});
    res.json(updatedBank);
  } catch (error) {
    console.error("Add content bank item error:", error);
    res.status(500).json({ error: "Server error updating content bank" });
  }
};
