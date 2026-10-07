export const TOPICS = ['Phishing', 'Smishing', 'Vishing', 'Pretexting', 'Baiting'];
export const numberOrNull = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
export function recordedMastery(student, records) {
  return Object.fromEntries(TOPICS.map(topic => {
    const matching = records.filter(r => String(r.student_id) === String(student.id) && r.topic?.toLowerCase() === topic.toLowerCase());
    // Conflicting undated observations cannot establish which value is current.
    matching.sort((a, b) => (Date.parse(b.updated_at || b.created_at) || 0) - (Date.parse(a.updated_at || a.created_at) || 0));
    let value = null;
    if (matching.length) {
      const dated = matching[0].updated_at || matching[0].created_at;
      if (dated || new Set(matching.map(r => r.probability_known)).size === 1) value = numberOrNull(matching[0].probability_known);
    } else {
      const legacy = numberOrNull(student[`mastery_${topic.toLowerCase()}`]);
      // Legacy zero columns were defaulted for untouched accounts; only an observation proves zero.
      if (legacy > 0) value = legacy;
    }
    return [topic, value !== null && value >= 0 && value <= 1 ? value : null];
  }));
}
export function assessment(row, kind) {
  const score = numberOrNull(row[kind]);
  const confirmed = Number.isFinite(Date.parse(row[`${kind}_completed_at`])) && score !== null && score >= 0;
  return { score: confirmed || score > 0 ? score : null, confirmed, scale: row[`${kind}_scale`] || null, pairId: row[`${kind}_assessment_pair_id`] || null, completedAt: row[`${kind}_completed_at`] || null };
}
export function mapLearner(row, records = []) {
  const mastery = recordedMastery(row, records);
  const values = Object.values(mastery).filter(v => v !== null);
  const preAssessment = assessment(row, 'pre'), postAssessment = assessment(row, 'post');
  const comparable = preAssessment.confirmed && postAssessment.confirmed && preAssessment.scale && preAssessment.scale === postAssessment.scale
    && preAssessment.pairId && preAssessment.pairId === postAssessment.pairId && Date.parse(postAssessment.completedAt) >= Date.parse(preAssessment.completedAt);
  return { _id: row.id, name: row.name, email: row.email, section: row.section, sectionId: row.section_id, gradeLevel: row.grade_level,
    sessions: row.sessions, points: row.points, technical: row.technical, lastActive: row.last_active, createdAt: row.created_at,
    pre: preAssessment.score, post: postAssessment.score, preAssessment, postAssessment,
    gain: comparable ? postAssessment.score - preAssessment.score : null,
    mastery, assessedTopics: values.length, bkt: values.length ? values.reduce((a,b) => a+b,0)/values.length : null,
    status: values.some(v => v < .4) ? 'At Risk' : values.length ? 'On Track' : 'Unassessed',
    failedTopics: TOPICS.filter(t => mastery[t] !== null && mastery[t] < .4) };
}
export function topicSummary(students) {
  return TOPICS.map(topic => {
    const values = students.map(s => s.mastery[topic]).filter(v => v !== null);
    const support = values.filter(v => v < .4).length;
    return { topic, assessed: values.length, unassessed: students.length-values.length, support,
      supportProportion: values.length ? support / values.length : null,
      mastery: values.length ? values.reduce((a,b) => a+b,0)/values.length : null };
  });
}
