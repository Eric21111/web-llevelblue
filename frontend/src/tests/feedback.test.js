import test from "node:test";
import assert from "node:assert/strict";
import { studentFeedback, filterFeedback, feedbackSummary, feedbackModule } from "../utils/feedback.js";

const rows = [
  { _id: "a", respondentRole: "student", section: "A", module: "Baiting", q1: 4, q2: 4, q3: 2, q4: 4, q5: 5, rating: 5, comments: "Explanation was unclear", createdAt: "2026-10-06" },
  { _id: "b", respondentRole: "student", section: "B", module: "Pretexting", q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, comments: "Helpful", createdAt: "2026-10-07" },
  { _id: "c", respondentRole: "legacy", section: "A", module: "Baiting", rating: 1, comments: "Staff review" },
];
test("only student responses enter section/module summaries", () => {
  const studentRows = studentFeedback(rows);
  assert.equal(studentRows.length, 2);
  const selected = filterFeedback(studentRows, "A", "Baiting");
  assert.deepEqual(selected.map(item => item._id), ["a"]);
  assert.equal(feedbackSummary(selected).overall.mean, 3.8);
  assert.equal(feedbackSummary(selected).difficulty.mean, 2);
  assert.equal(feedbackSummary(selected).lowDifficultyFit, 1);
  assert.equal(filterFeedback(studentRows, "A", "Pretexting").length, 0);
});
test("missing ratings are excluded from each denominator", () => {
  const summary = feedbackSummary([{ q1: 5, q3: null, rating: null }, { q1: null, q3: 2, rating: 3 }, { q1: false, q3: 0, rating: "" }]);
  assert.deepEqual(summary.overall, { count: 1, mean: 3 });
  assert.deepEqual(summary.difficulty, { count: 1, mean: 2 });
  assert.equal(summary.questions[0].mean, 5);
  assert.equal(summary.questions[0].count, 1);
  assert.equal(feedbackSummary([]).overall.mean, null);
});
test("written feedback is sorted newest first and module absence is explicit", () => {
  assert.deepEqual(feedbackSummary(studentFeedback(rows)).comments.map(item => item._id), ["b", "a"]);
  assert.equal(feedbackModule({}), "General app experience");
  assert.equal(feedbackSummary([{ comments: "  " }, {}]).comments.length, 0);
});
