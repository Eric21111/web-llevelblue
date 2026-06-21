export const SKILLS = ["Phishing", "Smishing", "Vishing", "Pretexting", "Baiting"];

export const classMasteryRadar = [
  { skill: "Phishing", mastery: 78, target: 70 },
  { skill: "Smishing", mastery: 62, target: 70 },
  { skill: "Vishing", mastery: 54, target: 70 },
  { skill: "Pretexting", mastery: 71, target: 70 },
  { skill: "Baiting", mastery: 68, target: 70 },
];

export const students = [
  { id: "S001", name: "Alyana Reyes", section: "Grade 10 - Diamond", mastery: { Phishing: 0.91, Smishing: 0.74, Vishing: 0.55, Pretexting: 0.82, Baiting: 0.77 }, pre: 42, post: 88, sessions: 14, points: 1240, lastActive: "2 hrs ago", technical: false, status: "On Track" },
  { id: "S002", name: "Miguel Santos", section: "Grade 10 - Diamond", mastery: { Phishing: 0.65, Smishing: 0.48, Vishing: 0.39, Pretexting: 0.51, Baiting: 0.60 }, pre: 38, post: 64, sessions: 9, points: 680, lastActive: "1 day ago", technical: false, status: "At Risk" },
  { id: "S003", name: "Jasmine Cortez", section: "Grade 10 - Diamond", mastery: { Phishing: 0.88, Smishing: 0.83, Vishing: 0.79, Pretexting: 0.85, Baiting: 0.81 }, pre: 55, post: 94, sessions: 18, points: 1580, lastActive: "5 hrs ago", technical: true, status: "On Track" },
  { id: "S004", name: "Carlo Dimaano", section: "Grade 10 - Diamond", mastery: { Phishing: 0.44, Smishing: 0.38, Vishing: 0.29, Pretexting: 0.41, Baiting: 0.35 }, pre: 30, post: 49, sessions: 5, points: 420, lastActive: "4 days ago", technical: false, status: "At Risk" },
  { id: "S005", name: "Bea Villaroman", section: "Grade 10 - Sapphire", mastery: { Phishing: 0.79, Smishing: 0.71, Vishing: 0.62, Pretexting: 0.74, Baiting: 0.69 }, pre: 47, post: 81, sessions: 12, points: 1120, lastActive: "Just now", technical: false, status: "On Track" },
  { id: "S006", name: "Patrick Ong", section: "Grade 10 - Sapphire", mastery: { Phishing: 0.92, Smishing: 0.89, Vishing: 0.85, Pretexting: 0.91, Baiting: 0.88 }, pre: 60, post: 97, sessions: 21, points: 1720, lastActive: "30 min ago", technical: true, status: "On Track" },
  { id: "S007", name: "Nadia Buena", section: "Grade 10 - Sapphire", mastery: { Phishing: 0.58, Smishing: 0.61, Vishing: 0.44, Pretexting: 0.52, Baiting: 0.49 }, pre: 35, post: 62, sessions: 8, points: 890, lastActive: "2 days ago", technical: false, status: "Needs Review" },
  { id: "S008", name: "Joaquin Fernandez", section: "Grade 10 - Sapphire", mastery: { Phishing: 0.36, Smishing: 0.41, Vishing: 0.25, Pretexting: 0.33, Baiting: 0.30 }, pre: 28, post: 45, sessions: 4, points: 350, lastActive: "6 days ago", technical: false, status: "At Risk" },
];

export const masteryGrowthOverTime = [
  { week: "Wk 1", Phishing: 22, Smishing: 18, Vishing: 15, Pretexting: 20, Baiting: 17 },
  { week: "Wk 2", Phishing: 35, Smishing: 28, Vishing: 24, Pretexting: 33, Baiting: 27 },
  { week: "Wk 3", Phishing: 48, Smishing: 39, Vishing: 32, Pretexting: 44, Baiting: 38 },
  { week: "Wk 4", Phishing: 58, Smishing: 47, Vishing: 40, Pretexting: 53, Baiting: 47 },
  { week: "Wk 5", Phishing: 68, Smishing: 55, Vishing: 47, Pretexting: 62, Baiting: 56 },
  { week: "Wk 6", Phishing: 78, Smishing: 62, Vishing: 54, Pretexting: 71, Baiting: 68 },
];

export const prePostComparison = students.map(s => ({
  name: s.name.split(" ")[0],
  pre: s.pre,
  post: s.post,
}));

export const quizTypeAccuracy = [
  { type: "Type A — Scenario", accuracy: 74, attempts: 412 },
  { type: "Type B — Spot the Phish", accuracy: 61, attempts: 298 },
  { type: "Type C — Rapid Fire", accuracy: 69, attempts: 355 },
];

export const slipPatterns = [
  { enemy: "Ransom-Worm", domain: "Technical", slips: 64 },
  { enemy: "The Pig-Butcher", domain: "Personal", slips: 58 },
  { enemy: "Tailgater Shadow", domain: "Physical", slips: 41 },
  { enemy: "USB Goblin", domain: "Physical", slips: 33 },
  { enemy: "Phish-Hook", domain: "Technical", slips: 22 },
];

export const engagementTrend = [
  { day: "Mon", sessions: 34 },
  { day: "Tue", sessions: 41 },
  { day: "Wed", sessions: 38 },
  { day: "Thu", sessions: 52 },
  { day: "Fri", sessions: 47 },
  { day: "Sat", sessions: 29 },
  { day: "Sun", sessions: 22 },
];

export const sectionComparison = [
  { section: "Diamond", gain: 38.5, teacher: "T. Climaco" },
  { section: "Sapphire", gain: 31.2, teacher: "T. Climaco" },
  { section: "Emerald", gain: 42.1, teacher: "E. Libradilla" },
  { section: "Topaz", gain: 27.8, teacher: "M. Ellih" },
];

export const teacherAccounts = [
  { name: "John Lloyd Climaco", email: "jl.climaco@wmsu.edu.ph", sections: 2, students: 56, status: "Active" },
  { name: "Eric Libradilla Jr.", email: "e.libradilla@wmsu.edu.ph", sections: 1, students: 31, status: "Active" },
  { name: "Marjouk Ellih", email: "m.ellih@wmsu.edu.ph", sections: 1, students: 27, status: "Active" },
  { name: "Dahlia Reyes", email: "d.reyes@wmsu.edu.ph", sections: 1, students: 24, status: "Invited" },
];

export const contentBank = [
  { skill: "Phishing", authored: 38, validated: 35, target: 40 },
  { skill: "Smishing", authored: 29, validated: 26, target: 40 },
  { skill: "Vishing", authored: 22, validated: 18, target: 40 },
  { skill: "Pretexting", authored: 31, validated: 30, target: 40 },
  { skill: "Baiting", authored: 26, validated: 24, target: 40 },
];

export const bktHealth = [
  { week: "Wk 1", rmse: 0.31, auc: 0.68 },
  { week: "Wk 2", rmse: 0.27, auc: 0.73 },
  { week: "Wk 3", rmse: 0.23, auc: 0.78 },
  { week: "Wk 4", rmse: 0.19, auc: 0.82 },
  { week: "Wk 5", rmse: 0.16, auc: 0.86 },
  { week: "Wk 6", rmse: 0.14, auc: 0.89 },
];

export const technicalVsNon = [
  { group: "Technical Users", pre: 56, post: 91 },
  { group: "Non-Technical Users", pre: 36, post: 67 },
];

export const demoAccounts = {
  admin: { email: "jl.climaco@wmsu.edu.ph", password: "levelblue2026", name: "John Lloyd Climaco", roleLabel: "Grade 10 Teacher" },
  super: { email: "headoffice@wmsu.edu.ph", password: "wmsuils2026", name: "WMSU-ILS Dept. Head", roleLabel: "Department Head" },
};
