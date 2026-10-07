import test from "node:test";
import assert from "node:assert/strict";
import { buildNotifications, notificationStorageKey, readNotificationReceipts } from "../utils/notifications.js";

const now = Date.parse("2026-10-07T12:00:00Z");
const data = {
  students: [{ id: "a", sessions: 1, lastActive: "2026-09-01" }, { id: "b", sessions: 0 }],
  risk: [{ id: "a", failingSkills: ["Phishing"] }],
  teachers: [{ id: "t", status: "Invited" }],
  content: [{ skill: "Phishing", authored: 2, target: 5 }],
  logs: [{ id: "recent", createdAt: "2026-10-07T10:00:00Z", action: "Added content" }, { id: "old", createdAt: "2026-09-01" }, { id: "future", createdAt: "2027-01-01" }],
};

test("notifications only link to screens available to their role", () => {
  assert.deepEqual(buildNotifications("admin", data, now).map(item => item.path), ["/follow-ups", "/roster", "/engagement"]);
  assert.deepEqual(buildNotifications("super", data, now).map(item => item.path), ["/school-progress", "/teachers", "/content", "/logs"]);
});
test("read revisions stay stable across ordering but change for new learners or skill gaps", () => {
  const first = buildNotifications("admin", data, now)[0];
  assert.equal(buildNotifications("admin", { ...data, students: [...data.students].reverse() }, now)[0].revision, first.revision);
  assert.notEqual(buildNotifications("admin", { ...data, risk: [{ id: "b", failingSkills: ["Phishing"] }] }, now)[0].revision, first.revision);
  assert.notEqual(buildNotifications("admin", { ...data, risk: [{ id: "a", failingSkills: ["Vishing"] }] }, now)[0].revision, first.revision);
});
test("unavailable or empty sources do not fabricate alerts", () => {
  assert.deepEqual(buildNotifications("super", {}, now), []);
  assert.deepEqual(buildNotifications("admin", { students: [], risk: data.risk }, now), []);
  assert.equal(buildNotifications("admin", { students: data.students }, now).some(item => item.id === "support"), false);
});
test("read storage is isolated by account and role and tolerates unavailable storage", () => {
  assert.notEqual(notificationStorageKey({ id: 1 }, "admin"), notificationStorageKey({ id: 2 }, "admin"));
  assert.notEqual(notificationStorageKey({ id: 1 }, "admin"), notificationStorageKey({ id: 1 }, "super"));
  assert.equal(notificationStorageKey({}, "admin"), null);
  assert.deepEqual(readNotificationReceipts({ getItem: () => { throw Error("blocked"); } }, "key"), {});
  assert.deepEqual(readNotificationReceipts({ getItem: () => "invalid" }, "key"), {});
  assert.deepEqual(readNotificationReceipts({ getItem: () => '{"support":"revision","bad":1}' }, "key"), { support: "revision" });
});
