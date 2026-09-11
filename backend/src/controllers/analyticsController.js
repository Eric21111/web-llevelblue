import { supabase } from "../config/db.js";

const SKILLS = ["Phishing", "Smishing", "Vishing", "Pretexting", "Baiting"];
const SKILL_COLUMNS = {
  Phishing: "mastery_phishing",
  Smishing: "mastery_smishing",
  Vishing: "mastery_vishing",
  Pretexting: "mastery_pretexting",
  Baiting: "mastery_baiting",
};
const WEEKDAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function safeSelect(table, columns = "*") {
  const query = supabase.from(table).select(columns);
  const { data, error } = await query;
  if (error) {
    console.warn(`Analytics query skipped for ${table}:`, error.message);
    return [];
  }
  return data || [];
}

function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstName(fullName) {
  if (!fullName || typeof fullName !== "string") return "Student";
  return fullName.trim().split(/\s+/)[0] || "Student";
}

function teacherDisplayName(user) {
  if (!user) return "Unassigned";
  const assembled = [user.first_name || user.firstName, user.last_name || user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return user.name || assembled || user.email || "Unassigned";
}

function isoWeekLabel(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const utc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function lastIsoWeeks(count = 6) {
  const labels = [];
  const cursor = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(cursor);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const label = isoWeekLabel(d);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

function shortWeekLabel(isoLabel) {
  if (!isoLabel) return "Now";
  const week = isoLabel.split("-W")[1];
  return week ? `W${week}` : isoLabel;
}

function average(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeRmse(predicted, actual) {
  if (!predicted.length || predicted.length !== actual.length) return null;
  const mse = predicted.reduce((sum, p, i) => sum + (p - actual[i]) ** 2, 0) / predicted.length;
  return Math.sqrt(mse);
}

function computeAuc(scores, labels) {
  const pos = [];
  const neg = [];
  scores.forEach((score, i) => {
    if (labels[i]) pos.push(score);
    else neg.push(score);
  });
  if (!pos.length || !neg.length) return null;
  let wins = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) wins += 1;
      else if (p === n) wins += 0.5;
    }
  }
  return wins / (pos.length * neg.length);
}

function roundMetric(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mergeMastery(student, bktByStudent) {
  const rec = bktByStudent[student.id] || {};
  const mastery = {};
  SKILLS.forEach((skill) => {
    const fromBkt = rec[skill];
    const fromRow = student[SKILL_COLUMNS[skill]];
    mastery[skill] = fromBkt !== undefined && fromBkt !== null ? num(fromBkt) : num(fromRow);
  });
  return mastery;
}

function classMasteryRadarFrom(studentsWithMastery) {
  return SKILLS.map((skill) => {
    const values = studentsWithMastery
      .map((s) => s.mastery[skill])
      .filter((v) => v !== undefined && v !== null);
    const masteryPct = values.length ? Math.round(average(values) * 100) : 0;
    return { skill, mastery: masteryPct, target: 70 };
  });
}

function bktHealthForGroup(group) {
  const scored = group.filter((s) => num(s.post) > 0);
  if (scored.length < 2) return { rmse: null, auc: null };
  const predicted = scored.map((s) => average(SKILLS.map((skill) => num(s.mastery[skill]))));
  const actual = scored.map((s) => Math.min(1, Math.max(0, num(s.post) / 100)));
  const labels = scored.map((s) => num(s.post) >= 70);
  return {
    rmse: roundMetric(computeRmse(predicted, actual), 2),
    auc: roundMetric(computeAuc(predicted, labels), 2),
  };
}

export async function buildAnalytics(req) {
  const [students, bktRows, teachers, saves] = await Promise.all([
    safeSelect("students"),
    safeSelect("bkt_records", "student_id, topic, probability_known"),
    safeSelect("users", "id, name, first_name, last_name, email, role, sections"),
    safeSelect("player_saves", "student_id, updated_at"),
  ]);

  const bktByStudent = {};
  bktRows.forEach((row) => {
    const topic = row.topic;
    if (!topic || !row.student_id) return;
    if (!bktByStudent[row.student_id]) bktByStudent[row.student_id] = {};
    bktByStudent[row.student_id][topic] = num(row.probability_known);
  });

  const studentsWithMastery = students.map((s) => ({
    ...s,
    mastery: mergeMastery(s, bktByStudent),
  }));

  const classMasteryRadar = classMasteryRadarFrom(studentsWithMastery);

  const prePostComparison = students.map((s) => ({
    name: firstName(s.name),
    pre: num(s.pre),
    post: num(s.post),
  }));

  const adminTeachers = teachers.filter((t) => t.role === "admin");
  const viewerName = teacherDisplayName(req?.user);
  const fallbackTeacher =
    req?.user?.role === "admin"
      ? viewerName
      : adminTeachers.length === 1
        ? teacherDisplayName(adminTeachers[0])
        : "Unassigned";

  const sections = [...new Set(students.map((s) => s.section).filter(Boolean))];
  const sectionComparison = sections.map((secName) => {
    const secStudents = students.filter((s) => s.section === secName);
    const avgGain = secStudents.length
      ? Number((secStudents.reduce((sum, s) => sum + (num(s.post) - num(s.pre)), 0) / secStudents.length).toFixed(1))
      : 0;
    return {
      section: String(secName).includes(" - ") ? String(secName).split(" - ").pop() : secName,
      gain: avgGain,
      teacher: fallbackTeacher,
    };
  });

  const techStudents = students.filter((s) => s.technical);
  const nonTechStudents = students.filter((s) => !s.technical);
  const avgPrePost = (list) => {
    if (!list.length) return { pre: 0, post: 0 };
    return {
      pre: Math.round(average(list.map((s) => num(s.pre)))),
      post: Math.round(average(list.map((s) => num(s.post)))),
    };
  };
  const techStats = avgPrePost(techStudents);
  const nonTechStats = avgPrePost(nonTechStudents);
  const technicalVsNon = [
    { group: "Technical Users", pre: techStats.pre, post: techStats.post },
    { group: "Non-Technical Users", pre: nonTechStats.pre, post: nonTechStats.post },
  ];

  const weekLabels = lastIsoWeeks(6);
  const masteryGrowthOverTime = weekLabels
    .map((label) => {
      const cohort = studentsWithMastery.filter((s) => {
        const stamp = s.last_active || s.updated_at || s.created_at;
        return stamp && isoWeekLabel(stamp) === label;
      });
      if (!cohort.length) return null;
      const item = { week: shortWeekLabel(label) };
      SKILLS.forEach((skill) => {
        item[skill] = Math.round(average(cohort.map((s) => num(s.mastery[skill]) * 100)));
      });
      return item;
    })
    .filter(Boolean);

  if (!masteryGrowthOverTime.length && studentsWithMastery.length) {
    const now = { week: "Now" };
    SKILLS.forEach((skill) => {
      now[skill] = Math.round(average(studentsWithMastery.map((s) => num(s.mastery[skill]) * 100)));
    });
    masteryGrowthOverTime.push(now);
  }

  const played = studentsWithMastery.filter((s) => num(s.sessions) > 0);
  const quizTypeAccuracy = SKILLS.map((skill) => {
    const pool = played.length ? played : studentsWithMastery;
    const values = pool.map((s) => num(s.mastery[skill]) * 100);
    return {
      type: skill,
      accuracy: values.length ? Math.round(average(values)) : 0,
      attempts: pool.reduce((sum, s) => sum + num(s.sessions), 0),
    };
  });

  const slipPatterns = SKILLS.map((skill) => ({
    enemy: skill,
    domain: "BKT",
    slips: studentsWithMastery.filter((s) => num(s.mastery[skill]) > 0 && num(s.mastery[skill]) < 0.4).length,
  }));

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const engagementCounts = Object.fromEntries(WEEKDAY_ORDER.map((d) => [d, 0]));
  const playStamps = [];
  saves.forEach((row) => {
    if (row.updated_at) playStamps.push(row.updated_at);
  });
  if (!playStamps.length) {
    students.forEach((s) => {
      if (s.last_active) playStamps.push(s.last_active);
    });
  }
  playStamps.forEach((stamp) => {
    const d = new Date(stamp);
    if (Number.isNaN(d.getTime()) || d.getTime() < weekAgo) return;
    const day = WEEKDAY_LABELS[d.getDay()];
    if (day && engagementCounts[day] !== undefined) engagementCounts[day] += 1;
  });
  const engagementTrend = WEEKDAY_ORDER.map((day) => ({
    day,
    sessions: engagementCounts[day] || 0,
  }));

  const bktHealth = weekLabels
    .map((label) => {
      const group = studentsWithMastery.filter((s) => {
        const stamp = s.last_active || s.updated_at || s.created_at;
        return stamp && isoWeekLabel(stamp) === label;
      });
      const metrics = bktHealthForGroup(group.length ? group : []);
      if (metrics.rmse === null && metrics.auc === null) return null;
      return { week: shortWeekLabel(label), rmse: metrics.rmse ?? 0, auc: metrics.auc ?? 0 };
    })
    .filter(Boolean);

  if (!bktHealth.length) {
    const nowMetrics = bktHealthForGroup(studentsWithMastery);
    if (nowMetrics.rmse !== null || nowMetrics.auc !== null) {
      bktHealth.push({
        week: "Now",
        rmse: nowMetrics.rmse ?? 0,
        auc: nowMetrics.auc ?? 0,
      });
    }
  }

  return {
    classMasteryRadar,
    prePostComparison,
    sectionComparison,
    technicalVsNon,
    masteryGrowthOverTime,
    quizTypeAccuracy,
    slipPatterns,
    engagementTrend,
    bktHealth,
  };
}

export const getAnalytics = async (req, res) => {
  try {
    const payload = await buildAnalytics(req);
    res.setHeader("Cache-Control", "no-store");
    res.json(payload);
  } catch (error) {
    console.error("Get analytics error:", error);
    res.status(500).json({ error: "Server error calculating analytics metrics" });
  }
};

export const getAnalyticsPreview = async (req, res) => {
  try {
    const { classMasteryRadar } = await buildAnalytics(req);
    res.json({ classMasteryRadar });
  } catch (error) {
    console.error("Get analytics preview error:", error);
    res.status(500).json({ error: "Server error calculating analytics preview" });
  }
};

function isRealTimestamp(value) {
  if (value === null || value === undefined || value === "") return false;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "just now") return false;
  return !Number.isNaN(new Date(text).getTime());
}

function hasLiveProgress(student, bktByStudent) {
  if (num(student.sessions) > 0) return true;
  if (num(student.pre) > 0) return true;
  const records = bktByStudent[student.id];
  return !!(records && Object.keys(records).length);
}

function liveLastActive(student) {
  if (isRealTimestamp(student.last_active)) return student.last_active;
  if (isRealTimestamp(student.updated_at)) return student.updated_at;
  return null;
}

export const getAtRisk = async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const MASTERY_THRESHOLD = 0.4;
    const { data: rows, error } = await supabase
      .from("students")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const bktRows = await safeSelect("bkt_records", "student_id, topic, probability_known");
    const bktByStudent = {};
    bktRows.forEach((row) => {
      if (!row.student_id || !row.topic) return;
      if (!bktByStudent[row.student_id]) bktByStudent[row.student_id] = {};
      bktByStudent[row.student_id][row.topic] = num(row.probability_known);
    });

    const atRisk = [];
    (rows || []).forEach((student) => {
      if (!hasLiveProgress(student, bktByStudent)) return;
      const mastery = mergeMastery(student, bktByStudent);
      const failingSkills = SKILLS.filter((skill) => (mastery[skill] ?? 1) < MASTERY_THRESHOLD);
      if (failingSkills.length < 1) return;
      atRisk.push({
        id: student.id,
        name: student.name,
        section: student.section,
        status: student.status,
        sessions: num(student.sessions),
        lastActive: liveLastActive(student),
        failingSkills,
        mastery,
      });
    });

    res.json(atRisk);
  } catch (error) {
    console.error("Get at-risk error:", error);
    res.status(500).json({ error: "Server error fetching at-risk students" });
  }
};
