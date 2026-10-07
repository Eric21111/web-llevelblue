import test from "node:test";
import { fakeDb } from "./helpers.js";
import assert from "node:assert/strict";
import { createFeedbackHandlers, validateStudentFeedback } from "../src/services/feedbackService.js";

const body = { q1: 4, q2: 4, q3: 2, q4: 4, q5: 5, module: "baiting", feedbackType: "bug", comments: "Button is unresponsive" };
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } }; }
function database({ rows = [], writeError = null } = {}) {
  const writes = [];
  const db = { writes, from(table) {
    let payload;
    return {
      select() { return this; }, eq(key, value) { assert.equal(key, "id"); assert.equal(value, "student-1"); return this; },
      async maybeSingle() { return { data: { id: "student-1", name: "Actual Student", section: "Actual Section" }, error: null }; },
      async order() { return { data: rows, error: null }; },
      insert(value) { payload = value; writes.push({ table, value }); return this; },
      async single() { return { data: { id: "feedback-1", ...payload }, error: writeError }; },
    };
  } };
  return db;
}
test("only students can submit; only staff can read", async () => {
  const db = { from() { throw Error("Unauthorized requests must not touch the database"); } };
  const handlers = createFeedbackHandlers(db);
  for (const role of ["admin", "super", undefined]) {
    const res = response(); await handlers.addFeedback({ user: { role }, body }, res); assert.equal(res.statusCode, 403);
  }
  const res = response(); await handlers.getFeedback({ user: { role: "student" } }, res); assert.equal(res.statusCode, 403);
});
test("student identity and section cannot be spoofed; overall rating is computed", async () => {
  const db = database(); const res = response();
  await createFeedbackHandlers(db).addFeedback({ user: { id: "student-1", role: "student" }, body: { ...body, studentId: "other", studentName: "Other", section: "Fake", respondentRole: "admin", rating: 5 } }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.studentId, "student-1");
  assert.equal(res.body.studentName, "Actual Student");
  assert.equal(res.body.section, "Actual Section");
  assert.equal(res.body.respondentRole, "student");
  assert.equal(res.body.rating, 3.8);
  assert.equal(res.body.module, "Baiting");
});
test("legacy rows are preserved but omitted from the viewer", async () => {
  const rows = [{ id: "old", teacher_name: "Teacher", section_id: "a" }, { id: "new", respondent_role: "student", student_name: "Student", section_id: "a" }];
  for (const role of ["admin", "super"]) {
    const res = response(); await createFeedbackHandlers(fakeDb({ feedback: rows, sections: [{scope_id:"a"}], teacher_sections: [{teacher_id:"teacher",section_id:"a"}] })).getFeedback({ user: { id:"teacher", role, status:"Active" } }, res);
    assert.deepEqual(res.body.map(item => item._id), ["new"]);
  }
});
test("invalid survey input is rejected and general app feedback needs no module", () => {
  for (const value of [null, false, "", 0, 6, 2.5]) assert.ok(validateStudentFeedback({ ...body, q3: value }).error);
  assert.ok(validateStudentFeedback(null).error);
  assert.ok(validateStudentFeedback({ ...body, module: "Unknown" }).error);
  assert.ok(validateStudentFeedback({ ...body, comments: " " }).error);
  assert.ok(validateStudentFeedback({ ...body, feedbackType: "other" }).error);
  assert.ok(validateStudentFeedback({ ...body, comments: "x".repeat(5001) }).error);
  assert.equal(validateStudentFeedback({ ...body, module: undefined }).value.module, null);
});
test("missing metadata columns give an explicit setup error", async () => {
  const res = response();
  await createFeedbackHandlers(database({ writeError: { code: "PGRST204" } })).addFeedback({ user: { id: "student-1", role: "student" }, body }, res);
  assert.equal(res.statusCode, 503);
});
