import { activeThisWeek, hasStarted, studentId, DAY_MS } from "./dashboard.js";

export function notificationStorageKey(user, role) {
  const identity = user?._id ?? user?.id ?? user?.email;
  return identity ? `levelblue:notifications:v1:${role}:${identity}` : null;
}

export function buildNotifications(role, data, now = Date.now()) {
  const items = [];
  const add = (id, records, title, text, path, kind, revision = studentId) => {
    if (!records.length) return;
    // A changed set of students or topics is new information even if its count is unchanged.
    items.push({ id, revision: JSON.stringify(records.map(revision).sort()), title, text, path, kind });
  };
  if (Array.isArray(data.students) && Array.isArray(data.risk)) {
    const ids = new Set(data.students.map(studentId));
    const risk = data.risk.filter(student => ids.has(studentId(student)));
    add("support", risk, `${risk.length} learner${risk.length === 1 ? " needs" : "s need"} support`, "At least one recorded skill is below 40%. Review where more practice could help.", role === "super" ? "/school-progress" : "/follow-ups", "support", student => `${studentId(student)}:${[...(student.failingSkills || [])].sort().join(",")}`);
  }
  if (role === "admin" && Array.isArray(data.students)) {
    const unstarted = data.students.filter(student => !hasStarted(student));
    add("not-started", unstarted, `${unstarted.length} learner${unstarted.length === 1 ? " hasn’t" : "s haven’t"} started`, "Check student access and help them begin their first session.", "/roster", "learning");
    const inactive = data.students.filter(student => hasStarted(student) && !activeThisWeek(student, now));
    add("inactive", inactive, `${inactive.length} learner${inactive.length === 1 ? " has" : "s have"} no activity in 7 days`, "Check participation and plan a follow-up.", "/engagement", "activity");
  }
  if (role === "super") {
    const invited = (data.teachers || []).filter(teacher => teacher.status === "Invited");
    add("invitations", invited, `${invited.length} teacher invitation${invited.length === 1 ? " is" : "s are"} pending`, "Help teachers complete their first sign-in.", "/teachers", "team");
    const pending = (data.content || []).filter(item => item.status === 'submitted');
    add("content", pending, `${pending.length} content revision${pending.length === 1 ? " needs" : "s need"} review`, "Review teacher submissions before publication.", "/content", "learning", item => `${item.id}:${item.version}`);
    const recent = (data.logs || []).filter(log => {
      const time = Date.parse(log.createdAt);
      return time <= now && time >= now - 7 * DAY_MS;
    }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 5);
    for (const log of recent) {
      const revision = JSON.stringify([log.createdAt, log.user, log.action, log.details]);
      items.push({ id: `log:${log._id ?? log.id ?? revision}`, revision, title: log.action || "School activity", text: `${log.user || "System"}${log.details ? ` · ${log.details}` : ""}`, path: "/logs", kind: "activity", time: log.createdAt });
    }
  }
  if(role === 'admin') {
    const returned = (data.content || []).filter(item => item.status === 'changes_requested');
    add('content-changes', returned, `${returned.length} draft${returned.length === 1 ? ' needs' : 's need'} changes`, 'Read the school head’s review and update your draft.', '/content', 'learning', item => `${item.id}:${item.version}`);
  }
  return items;
}

export function readNotificationReceipts(storage, key) {
  if (!key) return {};
  try {
    const parsed = JSON.parse(storage.getItem(key) || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "string").slice(-100));
  } catch { return {}; }
}
