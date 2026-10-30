export const NOT_RECORDED = 'Not recorded';
export const DEVELOPER_SOURCES = Object.freeze({});
export const DEVELOPER_NAV = [
  { label: 'Overview', path: '/dashboard', group: 'Overview' },
  { label: 'Assessment answers', path: '/answers', group: 'Learning' },
  { label: 'Learning analytics', path: '/analytics', group: 'Learning' },
  { label: 'BKT', path: '/bkt', group: 'Learning' },
  { label: 'Data monitoring', path: '/monitoring', group: 'Quality' },
  { label: 'Reports', path: '/reports', group: 'Quality' },
  { label: 'Account settings', path: '/settings', group: 'Workspace' },
];
export const DEVELOPER_EXCLUDED = ['/teachers', '/logs', '/roster', '/enrollment', '/content', '/follow-ups', '/interventions', '/password-assistance', '/teacher-activity', '/school-progress'];

export function consoleRole(role) {
  if (role === 'super' || role === 'developer') return role;
  return 'admin';
}
export function showMetric(value, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return NOT_RECORDED;
  return digits === 0 ? String(Math.round(value)) : value.toFixed(digits);
}
export function showPercent(ratio) {
  if (typeof ratio !== 'number' || !Number.isFinite(ratio)) return NOT_RECORDED;
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
  if (role === 'admin') return { icon: 'T', title: 'Teacher workspace', nav: 'Teacher navigation', crumb: 'Teaching', helpTitle: 'Teacher workspace', help: 'Start with follow-ups, then the roster and sections.', account: 'Teacher' };
  if (role === 'developer') return { icon: 'DV', title: 'Developer workspace', nav: 'Developer navigation', crumb: 'Development', helpTitle: 'Developer workspace', help: 'Review recorded learning data. This workspace is read only.', account: 'Developer' };
  return { icon: 'SH', title: 'School head workspace', nav: 'School head navigation', crumb: 'Administration', helpTitle: 'School head workspace', help: 'Manage people and content, then compare progress across sections.', account: 'School head' };
}
