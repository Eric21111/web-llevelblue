import test from "node:test";
import assert from "node:assert/strict";
import { SKILLS, DAY_MS, activeThisWeek, summarizeStudents, sectionSummaries, masteryPercent } from "../utils/dashboard.js";

const now = Date.parse("2026-10-06T12:00:00Z");
const mastery = value => Object.fromEntries(SKILLS.map(skill => [skill, value]));

test("weekly activity uses valid dates in the last seven days, not lifetime sessions", () => {
  assert.equal(activeThisWeek({ sessions: 10, lastActive: new Date(now - 8 * DAY_MS).toISOString() }, now), false);
  assert.equal(activeThisWeek({ lastActive: new Date(now - 7 * DAY_MS).toISOString() }, now), true);
  assert.equal(activeThisWeek({ lastActive: "Just now" }, now), false);
  assert.equal(activeThisWeek({ lastActive: new Date(now + DAY_MS).toISOString() }, now), false);
  assert.equal(activeThisWeek({ lastActive: null }, now), false);
});
test("participation groups are mutually exclusive, including support records with no sessions", () => {
  const students = [
    { _id: "a", sessions: 2, mastery: mastery(.8) },
    { _id: "b", sessions: 0, mastery: mastery(0) },
    { _id: "c", sessions: 0, mastery: mastery(0) },
  ];
  const summary = summarizeStudents(students, [{ id: "b" }], now);
  assert.equal(summary.progressing, 1);
  assert.equal(summary.needsSupport.length, 1);
  assert.equal(summary.notStarted.length, 1);
  assert.equal(summary.progressing + summary.needsSupport.length + summary.notStarted.length, summary.total);
});
test("missing mastery and students who have not started are not reported as zero mastery", () => {
  assert.equal(masteryPercent({ sessions: 0, mastery: mastery(0) }), null);
  assert.equal(masteryPercent({ sessions: 2, mastery: { Phishing: .8 } }), null);
  const summary = summarizeStudents([{ sessions: 2, mastery: mastery(.8) }, { sessions: 0, mastery: mastery(0) }], [], now);
  assert.equal(summary.mastery, 80);
  assert.ok(summary.skills.every(skill => skill.value === 80));
});
test("section summaries retain empty sections and do not count another section's flagged learners", () => {
  const sections = sectionSummaries([{ _id: "a", section: "A", sessions: 1, mastery: mastery(.3) }, { _id: "b", section: "B" }], [{ id: "a" }], [{ name: "C" }]);
  assert.deepEqual(sections.map(section => [section.name, section.total, section.needsSupport.length]), [["A", 1, 1], ["B", 1, 0], ["C", 0, 0]]);
});
test("empty datasets have no fabricated percentages", () => {
  const summary = summarizeStudents([], [], now);
  assert.equal(summary.mastery, null);
  assert.equal(summary.active, 0);
  assert.ok(summary.skills.every(skill => skill.value === null));
});
