export const FEEDBACK_QUESTIONS = [
  { key: "q1", label: "Ease of navigation" },
  { key: "q2", label: "Clarity of answer explanations" },
  { key: "q3", label: "Difficulty felt right" },
  { key: "q4", label: "Would recommend to a classmate" },
  { key: "q5", label: "Relevance to real scams" },
];
export const feedbackScore = value => value !== null && value !== undefined && value !== "" && typeof value !== "boolean" && Number.isFinite(Number(value)) && Number(value) >= 1 && Number(value) <= 5 ? Number(value) : null;
export const feedbackSection = item => item.section?.trim() || "Section not recorded";
export const feedbackModule = item => item.module?.trim() || "General app experience";
export const studentFeedback = items => items.filter(item => item.respondentRole === "student");
export const filterFeedback = (items, section, module) => items.filter(item => (!section || feedbackSection(item) === section) && (!module || feedbackModule(item) === module));

function average(values) {
  const valid = values.filter(value => value !== null);
  return { count: valid.length, mean: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null };
}
export function feedbackSummary(items) {
  const overall = average(items.map(item => {
    const scores = FEEDBACK_QUESTIONS.map(question => feedbackScore(item[question.key]));
    return scores.every(score => score !== null) ? scores.reduce((a, b) => a + b, 0) / scores.length : feedbackScore(item.rating);
  }));
  const difficulty = average(items.map(item => feedbackScore(item.q3)));
  return { total: items.length, overall, difficulty,
    lowDifficultyFit: items.filter(item => feedbackScore(item.q3) !== null && feedbackScore(item.q3) <= 2).length,
    questions: FEEDBACK_QUESTIONS.map(question => ({ ...question, ...average(items.map(item => feedbackScore(item[question.key]))) })),
    comments: items.filter(item => typeof item.comments === "string" && item.comments.trim()).sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)),
  };
}
