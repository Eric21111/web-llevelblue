import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SKILLS = ["Phishing", "Smishing", "Vishing", "Pretexting", "Baiting"];

const QUESTIONS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../mobile-godot/LevelBluer/frontend/data/questions.json"
);

function emptyCounts() {
  return Object.fromEntries(SKILLS.map((skill) => [skill, 0]));
}

export function countAuthoredBySkill() {
  const counts = emptyCounts();
  try {
    if (!fs.existsSync(QUESTIONS_PATH)) return counts;
    const raw = fs.readFileSync(QUESTIONS_PATH, "utf8");
    const bank = JSON.parse(raw);
    const topic = String(bank.topic || "Phishing");
    const skill = SKILLS.find((s) => s.toLowerCase() === topic.toLowerCase()) || "Phishing";
    const types = Array.isArray(bank.question_types) ? bank.question_types : [];
    let total = 0;
    types.forEach((type) => {
      const questions = Array.isArray(type.questions) ? type.questions : [];
      total += questions.length;
    });
    counts[skill] = total;
    return counts;
  } catch (error) {
    console.warn("Could not read live question bank:", error.message);
    return counts;
  }
}

export { SKILLS as CONTENT_SKILLS };
