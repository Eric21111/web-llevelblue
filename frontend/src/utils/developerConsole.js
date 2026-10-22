export const NOT_RECORDED = 'Not recorded';
export const DEVELOPER_SOURCES = Object.freeze({});
export const DEVELOPER_NAV = [
  { label: 'Overview', path: '/dashboard', group: 'Overview' },
  { label: 'Assessment answers', path: '/answers', group: 'Evidence' },
  { label: 'Learning analytics', path: '/analytics', group: 'Evidence' },
  { label: 'BKT analytics', path: '/bkt', group: 'Evidence' },
  { label: 'Data monitoring', path: '/monitoring', group: 'Evidence' },
  { label: 'Reports', path: '/reports', group: 'Evidence' },
  { label: 'Account settings', path: '/settings', group: 'Workspace' },
];
export const DEVELOPER_EXCLUDED = ['/teachers', '/logs', '/roster', '/enrollment', '/content', '/follow-ups', '/interventions', '/password-assistance', '/teacher-activity', '/school-progress'];

export function consoleRole(role) {
  if (role === 'super' || role === 'developer') return role;
  return 'admin';
}
export function showMetric(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
}
export function showPercent(ratio) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return '—';
  return `${(ratio * 100).toFixed(1)}%`;
}
export function answerState(attempt) {
  return attempt?.answersStatus === 'recorded' ? 'Recorded' : NOT_RECORDED;
}
export function compareAttempts(left, right) {
  const ids = [];
  for (const attempt of [left, right]) {
    for (const answer of attempt?.answers || []) {
      if (answer?.questionId && !ids.includes(answer.questionId)) ids.push(answer.questionId);
    }
  }
  return ids.map(questionId => ({
    questionId,
    left: left?.answers?.find(answer => answer.questionId === questionId) || null,
    right: right?.answers?.find(answer => answer.questionId === questionId) || null,
  }));
}
export function workspaceCopy(role) {
  if (role === 'admin') return { icon: 'T', title: 'Teacher workspace', nav: 'Teacher navigation', crumb: 'Teaching', helpTitle: 'Your teacher workspace', help: 'Start with student follow-ups to find learning gaps. Use the roster for student records and sections to organize classes.', account: 'Teacher' };
  if (role === 'developer') return { icon: 'DV', title: 'Developer workspace', nav: 'Developer navigation', crumb: 'Development', helpTitle: 'Your developer workspace', help: 'Review recorded assessments, learning analytics, and data quality. This workspace is read only.', account: 'Developer' };
  return { icon: 'SH', title: 'School head workspace', nav: 'School head navigation', crumb: 'Administration', helpTitle: 'Your school head workspace', help: 'Manage teacher accounts and training content, then use School Progress to compare participation and support needs.', account: 'School head' };
}
