export const SKILLS = ["Phishing", "Smishing", "Vishing", "Pretexting", "Baiting"];
export const DAY_MS = 86400000;
export const studentId = student => String(student._id ?? student.id ?? "");
export const hasStarted = student => Number(student.sessions) > 0 || Number(student.pre) > 0 || Object.values(student.mastery || {}).some(value => Number(value) > 0);
export const timestamp = value => value ? Date.parse(value) : NaN;
export function activeThisWeek(student, now = Date.now()) {
  const time = timestamp(student.lastActive);
  return Number.isFinite(time) && time <= now && time >= now - 7 * DAY_MS;
}
export function masteryPercent(student) {
  const values = SKILLS.map(skill => student.mastery?.[skill]);
  if (!hasStarted(student) || values.some(value => value === null || value === undefined || !Number.isFinite(Number(value)))) return null;
  return Math.round(values.reduce((sum, value) => sum + Math.min(1, Math.max(0, Number(value))), 0) / SKILLS.length * 100);
}
export function summarizeStudents(students, atRisk, now = Date.now()) {
  const riskIds = new Set(atRisk.map(studentId));
  const needsSupport = students.filter(student => riskIds.has(studentId(student)));
  const notStarted = students.filter(student => !riskIds.has(studentId(student)) && !hasStarted(student));
  const progressing = students.length - needsSupport.length - notStarted.length;
  const masteryValues = students.map(masteryPercent).filter(value => value !== null);
  const skills = SKILLS.map(skill => {
    const values = students.filter(hasStarted).map(student => student.mastery?.[skill]).filter(value => value !== null && value !== undefined && Number.isFinite(Number(value)));
    return { name: skill, value: values.length ? Math.round(values.reduce((sum, value) => sum + Math.min(1, Math.max(0, Number(value))), 0) / values.length * 100) : null };
  });
  return {
    total: students.length, started: students.filter(hasStarted).length,
    active: students.filter(student => activeThisWeek(student, now)).length,
    needsSupport, notStarted, progressing,
    mastery: masteryValues.length ? Math.round(masteryValues.reduce((sum, value) => sum + value, 0) / masteryValues.length) : null,
    skills,
  };
}
export function sectionSummaries(students, atRisk, sections = []) {
  const names = [...new Set([...sections.map(section => section.name), ...students.map(student => student.section || "Unassigned")].filter(Boolean))];
  return names.sort((a, b) => a.localeCompare(b)).map(name => ({ name, ...summarizeStudents(students.filter(student => (student.section || "Unassigned") === name), atRisk) }));
}
export function initials(name = "") { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "LB"; }
export function formatPercent(value) { return value === null || value === undefined ? "—" : `${value}%`; }
