import { allRows, rowsForIds, fail } from './access.js';
import { TOPICS, mapLearner } from './learning.js';
import { summarizeEvidence } from './learningRecords.js';
import { sanitizeMonitorMessage } from './operationalEvents.js';

export const NOT_RECORDED = 'Not recorded';
export const AT_RISK_THRESHOLD = 0.4;
export const MASTERY_TARGET = 0.7;
export const MODULE_TOPICS = { mod_01: 'Phishing', mod_02: 'Smishing', mod_03: 'Vishing', mod_04: 'Pretexting', mod_05: 'Baiting' };
const DAY_MS = 86400000;
const GAIN_NOTE = 'A learning gain is calculated only for the first completed post-test after a pre-test when both share a comparison key and the same scale. Different instruments are listed separately and are not paired from equal percentages.';

export function parseFilters(query = {}) {
  const grade = query.grade ? String(query.grade) : '';
  const sectionId = query.sectionId ? String(query.sectionId) : '';
  const topic = query.topic ? String(query.topic) : '';
  const from = query.from ? String(query.from) : '';
  const to = query.to ? String(query.to) : '';
  const q = String(query.q || '').trim().slice(0, 100);
  if (grade && !['Grade 11', 'Grade 12'].includes(grade)) throw fail(400, 'Choose Grade 11 or Grade 12.');
  if (topic && !TOPICS.includes(topic)) throw fail(400, 'Choose a recorded topic.');
  if (sectionId && (sectionId.length > 80 || /[\r\n]/.test(sectionId))) throw fail(400, 'Choose a valid section.');
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw fail(400, 'Use a start date in YYYY-MM-DD format.');
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw fail(400, 'Use an end date in YYYY-MM-DD format.');
  if (from && to && from > to) throw fail(400, 'The start date must be on or before the end date.');
  return { grade, sectionId, topic, from, to, q };
}

function day(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null;
}
function inRange(value, filters) {
  const stamp = day(value);
  if (!stamp) return false;
  if (filters.from && stamp < filters.from) return false;
  if (filters.to && stamp > filters.to) return false;
  return true;
}
function topicOf(record) {
  return TOPICS.includes(record.data?.topic) ? record.data.topic : (MODULE_TOPICS[record.module_id] || null);
}
function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
function average(values) {
  const nums = values.filter(value => typeof value === 'number' && Number.isFinite(value));
  if (!nums.length) return null;
  return Math.round((nums.reduce((sum, value) => sum + value, 0) / nums.length) * 10) / 10;
}
function roundRatio(value) {
  return value === null ? null : Math.round(value * 1000) / 1000;
}
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function sectionOptions(sections, filters) {
  return sections
    .filter(section => !filters.grade || section.grade_level === filters.grade)
    .map(section => ({ id: section.scope_id, name: section.name, gradeLevel: section.grade_level || null }));
}
function cohortRows(students, sections, filters) {
  const sectionsById = new Map(sections.map(section => [section.scope_id, section]));
  return students.filter(student => {
    const section = sectionsById.get(student.section_id);
    const grade = student.grade_level || section?.grade_level || null;
    if (filters.grade && grade !== filters.grade) return false;
    if (filters.sectionId && student.section_id !== filters.sectionId) return false;
    return true;
  }).map(student => {
    const section = sectionsById.get(student.section_id);
    const dated = Boolean(filters.from || filters.to);
    const row = { ...student, grade_level: student.grade_level || section?.grade_level || null, section: student.section || section?.name || null };
    if (dated) for (const topic of TOPICS) row[`mastery_${topic.toLowerCase()}`] = null;
    return row;
  });
}
function visibleLearning(records, studentIds, filters) {
  const ids = new Set(studentIds.map(String));
  return records.filter(record => ids.has(String(record.student_id)) && (!filters.topic || topicOf(record) === filters.topic) && (!(filters.from || filters.to) || inRange(record.occurred_at, filters)));
}
function answerFields(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    questionId: typeof item.question_id === 'string' && item.question_id ? item.question_id : null,
    prompt: typeof item.prompt === 'string' && item.prompt ? item.prompt : NOT_RECORDED,
    selectedAnswer: typeof item.selected_answer === 'string' && item.selected_answer ? item.selected_answer : NOT_RECORDED,
    correctAnswer: typeof item.correct_answer === 'string' && item.correct_answer ? item.correct_answer : NOT_RECORDED,
    correct: typeof item.correct === 'boolean' ? item.correct : null,
  };
}
export function presentAttempt(record) {
  const responses = Array.isArray(record.data?.responses) ? record.data.responses.map(answerFields).filter(Boolean) : [];
  const recorded = responses.length > 0;
  return {
    id: record.id,
    eventId: record.event_id,
    studentId: String(record.student_id),
    kind: record.kind,
    moduleId: record.module_id,
    topic: topicOf(record),
    instrument: record.data?.instrument || null,
    scale: record.data?.scale || null,
    comparisonKey: record.data?.comparison_key || null,
    score: finiteNumber(record.data?.score),
    correctCount: finiteNumber(record.data?.correct),
    total: finiteNumber(record.data?.total),
    completed: record.data?.completed === true,
    occurredAt: record.occurred_at || null,
    source: record.data?.source || null,
    answersStatus: recorded ? 'recorded' : 'not-recorded',
    answers: recorded ? responses : [],
  };
}
function numberAttempts(attempts) {
  const counts = new Map();
  return [...attempts].sort((a, b) => (Date.parse(a.occurredAt) || 0) - (Date.parse(b.occurredAt) || 0) || String(a.eventId).localeCompare(String(b.eventId))).map(attempt => {
    const key = `${attempt.studentId}:${attempt.kind}:${attempt.moduleId}`;
    const attemptNumber = (counts.get(key) || 0) + 1;
    counts.set(key, attemptNumber);
    return { ...attempt, attemptNumber };
  });
}
function learningPairs(records) {
  const byStudent = new Map();
  for (const record of records) {
    const key = String(record.student_id);
    byStudent.set(key, [...(byStudent.get(key) || []), record]);
  }
  const pairs = [];
  for (const [studentId, rows] of byStudent) {
    for (const pair of summarizeEvidence(rows).pairs) {
      const sample = rows.find(row => row.module_id === pair.moduleId);
      pairs.push({ studentId, moduleId: pair.moduleId, topic: sample ? topicOf(sample) : null, pre: pair.pre, post: pair.post, gain: pair.gain, scale: pair.scale, comparisonKey: pair.comparisonKey, preEvent: pair.preEvent, postEvent: pair.postEvent, source: 'learning-record' });
    }
  }
  return pairs;
}
function publicStudent(student) {
  return { id: student._id, name: student.name, section: student.section || 'Unassigned', sectionId: student.sectionId || null, gradeLevel: student.gradeLevel || null, enrollmentStatus: student.enrollmentStatus || 'active' };
}
function activeStudent(student, records, filters, now) {
  if (filters.from || filters.to) {
    const seen = Number.isFinite(Date.parse(student.lastActive)) && inRange(student.lastActive, filters);
    return seen || records.some(record => String(record.student_id) === String(student._id));
  }
  const time = Date.parse(student.lastActive);
  return Number.isFinite(time) && time <= now && time >= now - 7 * DAY_MS;
}
function columnAssessment(student, kind) {
  const assessment = student[kind === 'pretest' ? 'preAssessment' : 'postAssessment'];
  if (!assessment?.confirmed) return null;
  return assessment;
}

export function buildDeveloperSnapshot(input, filters, now = Date.now()) {
  const sections = input.sections || [];
  const dated = Boolean(filters.from || filters.to);
  const rows = cohortRows(input.students || [], sections, filters);
  const bkt = dated ? [] : (input.bkt || []).filter(row => rows.some(student => String(student.id) === String(row.student_id)));
  const learners = rows.map(row => mapLearner(row, bkt));
  const learning = input.learningAvailable === false ? [] : visibleLearning(input.learning || [], learners.map(student => student._id), filters);
  const attempts = numberAttempts(learning.filter(record => ['pretest', 'posttest'].includes(record.kind)).map(presentAttempt));
  const pairs = learningPairs(learning);
  const pairedStudents = new Set(pairs.map(pair => pair.studentId));
  const columnPairs = filters.topic ? [] : learners.filter(student => student.gain !== null && !pairedStudents.has(String(student._id))).map(student => ({ studentId: String(student._id), moduleId: null, topic: null, pre: student.pre, post: student.post, gain: student.gain, scale: student.preAssessment.scale, comparisonKey: student.preAssessment.pairId, source: 'student-record' }));
  const comparable = [...pairs, ...columnPairs];
  const byStudentAttempts = studentId => attempts.filter(attempt => attempt.studentId === String(studentId));
  const hasRecorded = (student, kind) => byStudentAttempts(student._id).some(attempt => attempt.kind === kind && attempt.completed);
  const completed = kind => learners.filter(student => hasRecorded(student, kind) || (!filters.topic && !hasRecorded(student, kind) && columnAssessment(student, kind) && (!(filters.from || filters.to) || inRange(columnAssessment(student, kind).completedAt, filters)))).length;
  const scoreValues = kind => {
    const fromRecords = attempts.filter(attempt => attempt.kind === kind && attempt.completed && attempt.score !== null).map(attempt => attempt.score);
    if (filters.topic) return fromRecords;
    const fromColumns = learners.filter(student => !hasRecorded(student, kind)).map(student => columnAssessment(student, kind)).filter(assessment => assessment && (!(filters.from || filters.to) || inRange(assessment.completedAt, filters)) && assessment.score !== null).map(assessment => assessment.score);
    return [...fromRecords, ...fromColumns];
  };
  const masteryEvents = learning.filter(record => record.kind === 'mastery' && typeof record.data?.mastery === 'number' && record.data.mastery >= 0 && record.data.mastery <= 1);
  const questions = new Map();
  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      if (!answer.questionId || answer.correct === null) continue;
      const key = `${attempt.topic || ''}:${answer.questionId}`;
      const item = questions.get(key) || { questionId: answer.questionId, prompt: answer.prompt, topic: attempt.topic, asked: 0, correct: 0, missed: 0 };
      item.asked += 1;
      if (answer.correct) item.correct += 1;
      else item.missed += 1;
      if (item.prompt === NOT_RECORDED && answer.prompt !== NOT_RECORDED) item.prompt = answer.prompt;
      questions.set(key, item);
    }
  }
  const questionStats = [...questions.values()].map(item => ({ ...item, percentCorrect: roundRatio(item.correct / item.asked) })).sort((a, b) => a.percentCorrect - b.percentCorrect || b.missed - a.missed);
  const bktStudents = learners.map(student => {
    const topics = TOPICS.filter(topic => !filters.topic || topic === filters.topic).map(topic => {
      const probability = student.mastery[topic];
      const observed = (input.bkt || []).some(row => String(row.student_id) === String(student._id) && row.topic?.toLowerCase() === topic.toLowerCase());
      const source = probability === null ? null : observed && !dated ? 'bkt_records' : 'legacy-student-column';
      return { topic, probability, recordedAt: null, source, state: probability === null ? 'unobserved' : probability < AT_RISK_THRESHOLD ? 'at-risk' : probability >= MASTERY_TARGET ? 'target-met' : 'developing' };
    });
    return { ...publicStudent(student), topics, atRisk: topics.filter(topic => topic.state === 'at-risk').map(topic => topic.topic) };
  });
  const operations = (input.operationsAvailable === false ? [] : input.operations || []).filter(event => ['api-error', 'sync-failure', 'invalid-event', 'duplicate-event'].includes(event.category) && (!(filters.from || filters.to) || inRange(event.occurred_at, filters))).map(event => ({ id: event.id, occurredAt: event.occurred_at, category: event.category, status: event.status ?? null, code: event.code || null, route: event.route || null, message: sanitizeMonitorMessage(event.message) }));
  return {
    filters, sections: sectionOptions(sections, filters), topics: TOPICS, learners, attempts, pairs: comparable, questionStats, bktStudents, masteryEvents, operations,
    learningAvailable: input.learningAvailable !== false,
    bktAvailable: input.bktAvailable !== false,
    operationsAvailable: input.operationsAvailable !== false,
    dated,
    completedPretests: completed('pretest'),
    completedPosttests: completed('posttest'),
    activeLearners: learners.filter(student => activeStudent(student, learning, filters, now)).length,
    averagePretest: average(scoreValues('pretest')),
    averagePosttest: average(scoreValues('posttest')),
    averageGain: average(comparable.map(pair => pair.gain)),
  };
}

function frame(snapshot) {
  return { readOnly: true, filters: snapshot.filters, sections: snapshot.sections, topics: snapshot.topics };
}
export function overviewReport(snapshot) {
  return { ...frame(snapshot), overview: {
    totalStudents: snapshot.learners.length,
    completedPretests: snapshot.completedPretests,
    completedPosttests: snapshot.completedPosttests,
    averagePretest: snapshot.averagePretest,
    averagePosttest: snapshot.averagePosttest,
    averageGain: snapshot.averageGain,
    comparablePairs: snapshot.pairs.length,
    activeLearners: snapshot.activeLearners,
    activeDefinition: snapshot.dated ? 'Students with last activity or a learning record inside the selected dates.' : 'Students whose last activity is within the past 7 days.',
    limitations: [GAIN_NOTE, snapshot.learningAvailable ? 'Item responses appear only when a learning record stored them.' : 'Learning records are not available yet. Apply backend/migrations/20261008_learning_records.sql.', 'Missing scores and missing mastery are omitted. They are not counted as zero.'],
  } };
}
export function studentDirectory(snapshot) {
  const q = snapshot.filters.q.toLowerCase();
  return { ...frame(snapshot), students: snapshot.learners.filter(student => !q || String(student.name || '').toLowerCase().includes(q)).map(publicStudent) };
}
export function assessmentReport(snapshot, studentId) {
  const student = snapshot.learners.find(item => String(item._id) === String(studentId));
  if (!student) return null;
  const attempts = snapshot.attempts.filter(attempt => attempt.studentId === String(student._id));
  const comparisons = snapshot.pairs.filter(pair => pair.studentId === String(student._id));
  return { ...frame(snapshot), student: publicStudent(student), attempts, comparisons, note: attempts.length && !comparisons.length ? 'These attempts are shown separately because their instruments or scales are not a confirmed comparable pair.' : GAIN_NOTE };
}
export function analyticsReport(snapshot) {
  const topics = TOPICS.filter(topic => !snapshot.filters.topic || topic === snapshot.filters.topic).map(topic => {
    const topicAttempts = snapshot.attempts.filter(attempt => attempt.topic === topic && attempt.completed);
    const topicPairs = snapshot.pairs.filter(pair => pair.topic === topic);
    return { topic, pretest: average(topicAttempts.filter(attempt => attempt.kind === 'pretest').map(attempt => attempt.score)), posttest: average(topicAttempts.filter(attempt => attempt.kind === 'posttest').map(attempt => attempt.score)), gain: average(topicPairs.map(pair => pair.gain)), pretestCount: topicAttempts.filter(attempt => attempt.kind === 'pretest').length, posttestCount: topicAttempts.filter(attempt => attempt.kind === 'posttest').length };
  });
  const sections = snapshot.sections.map(section => {
    const members = snapshot.learners.filter(student => student.sectionId === section.id);
    const done = kind => members.filter(student => snapshot.attempts.some(attempt => attempt.studentId === String(student._id) && attempt.kind === kind && attempt.completed)).length;
    const gains = snapshot.pairs.filter(pair => members.some(student => String(student._id) === pair.studentId)).map(pair => pair.gain);
    return { ...section, students: members.length, pretestCompletion: members.length ? roundRatio(done('pretest') / members.length) : null, posttestCompletion: members.length ? roundRatio(done('posttest') / members.length) : null, averageGain: average(gains) };
  });
  return { ...frame(snapshot), gainNote: GAIN_NOTE, topicPerformance: topics, questionDifficulty: snapshot.questionStats, frequentlyMissed: [...snapshot.questionStats].sort((a, b) => b.missed - a.missed || a.percentCorrect - b.percentCorrect).slice(0, 10), sections, comparablePairs: snapshot.pairs.length, averageGain: snapshot.averageGain, exportRows: exportRows(snapshot).length };
}
export function bktReport(snapshot) {
  return { ...frame(snapshot), available: snapshot.bktAvailable, thresholds: { atRisk: AT_RISK_THRESHOLD, target: MASTERY_TARGET, explanation: 'At risk means a recorded probability of knowledge below 0.40, the same threshold used for learning support. The 0.70 line is an instructional target. Missing observations stay blank and are not treated as zero or as mastered. bkt_records does not store an observation time; dated progression comes only from mastery learning records.' }, datedNote: snapshot.dated ? 'Undated bkt_records are omitted while a date filter is on. They are not copied in as current mastery.' : null, students: snapshot.bktStudents, progression: snapshot.masteryEvents.map(record => ({ studentId: String(record.student_id), topic: topicOf(record), mastery: record.data.mastery, occurredAt: record.occurred_at })), atRisk: snapshot.bktStudents.filter(student => student.atRisk.length).map(student => ({ id: student.id, name: student.name, section: student.section, gradeLevel: student.gradeLevel, topics: student.atRisk })) };
}
export function monitoringReport(snapshot) {
  const of = category => snapshot.operations.filter(event => event.category === category);
  return { ...frame(snapshot), available: snapshot.operationsAvailable, learningAvailable: snapshot.learningAvailable, note: 'Only stored monitoring events are listed. Missing logs are not filled with sample errors. Answer rows are not reconstructed from scores.', incompleteAssessments: snapshot.attempts.filter(attempt => !attempt.completed).map(attempt => ({ studentId: attempt.studentId, name: snapshot.learners.find(student => String(student._id) === attempt.studentId)?.name || 'Student', topic: attempt.topic, kind: attempt.kind, occurredAt: attempt.occurredAt })), missingAnswers: snapshot.attempts.filter(attempt => attempt.completed && attempt.answersStatus !== 'recorded').map(attempt => ({ studentId: attempt.studentId, name: snapshot.learners.find(student => String(student._id) === attempt.studentId)?.name || 'Student', topic: attempt.topic, kind: attempt.kind, occurredAt: attempt.occurredAt, answers: NOT_RECORDED })), invalidEvents: of('invalid-event'), duplicateEvents: of('duplicate-event'), syncFailures: of('sync-failure'), apiErrors: of('api-error') };
}
function exportRows(snapshot) {
  const names = new Map(snapshot.learners.map(student => [String(student._id), student]));
  const gainByEvent = new Map(snapshot.pairs.filter(pair => pair.postEvent).map(pair => [String(pair.postEvent), pair.gain]));
  const rows = [];
  for (const attempt of snapshot.attempts) {
    const student = names.get(attempt.studentId);
    const base = [student?.name || '', student?.section || '', student?.gradeLevel || '', attempt.topic || '', attempt.kind, attempt.instrument || '', attempt.scale || '', attempt.comparisonKey || '', attempt.score ?? '', attempt.correctCount ?? '', attempt.total ?? '', attempt.completed ? 'yes' : 'no', attempt.occurredAt || '', attempt.source || ''];
    const gain = gainByEvent.has(String(attempt.eventId)) ? gainByEvent.get(String(attempt.eventId)) : '';
    const answers = attempt.answers.length ? attempt.answers : [null];
    for (const answer of answers) rows.push([...base, answer ? (answer.questionId || NOT_RECORDED) : NOT_RECORDED, answer ? answer.prompt : NOT_RECORDED, answer ? answer.selectedAnswer : NOT_RECORDED, answer ? answer.correctAnswer : NOT_RECORDED, answer ? (answer.correct === null ? NOT_RECORDED : answer.correct ? 'yes' : 'no') : NOT_RECORDED, gain]);
  }
  if (!snapshot.filters.topic) {
    const covered = new Set(snapshot.attempts.filter(attempt => attempt.completed).map(attempt => `${attempt.studentId}:${attempt.kind}`));
    for (const student of snapshot.learners) {
      for (const kind of ['pretest', 'posttest']) {
        if (covered.has(`${student._id}:${kind}`)) continue;
        const assessment = columnAssessment(student, kind);
        if (!assessment || ((snapshot.filters.from || snapshot.filters.to) && !inRange(assessment.completedAt, snapshot.filters))) continue;
        const gain = kind === 'posttest' && student.gain !== null ? student.gain : '';
        rows.push([student.name || '', student.section || '', student.gradeLevel || '', '', kind, '', assessment.scale || '', assessment.pairId || '', assessment.score ?? '', '', '', 'yes', assessment.completedAt || '', 'student-record', NOT_RECORDED, NOT_RECORDED, NOT_RECORDED, NOT_RECORDED, NOT_RECORDED, gain]);
      }
    }
  }
  return rows;
}
export function exportCsv(snapshot) {
  const header = ['student_name', 'section', 'grade', 'topic', 'assessment', 'instrument', 'scale', 'comparison_key', 'score', 'correct', 'total', 'completed', 'occurred_at', 'source', 'question_id', 'prompt', 'selected_answer', 'correct_answer', 'answer_correct', 'comparable_gain'];
  return [header, ...exportRows(snapshot)].map(row => row.map(csvCell).join(',')).join('\n');
}

export async function fetchDeveloperInputs(db) {
  const sections = await allRows(db.from('sections').select('scope_id,name,grade_level').order('id'));
  const students = await allRows(db.from('students').select('id,name,section,section_id,grade_level,enrollment_status,last_active,pre,post,pre_completed_at,post_completed_at,pre_scale,post_scale,pre_assessment_pair_id,post_assessment_pair_id,mastery_phishing,mastery_smishing,mastery_vishing,mastery_pretexting,mastery_baiting').order('id'));
  const ids = students.map(student => student.id);
  const optional = async (loader) => {
    try { return { rows: await loader(), available: true }; }
    catch (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) return { rows: [], available: false };
      throw error;
    }
  };
  const learning = await optional(() => rowsForIds(db, 'learning_records', 'student_id', ids));
  const bkt = await optional(() => rowsForIds(db, 'bkt_records', 'student_id', ids, 'student_id,topic,probability_known'));
  const operations = await optional(() => allRows(db.from('operational_events').select('id,occurred_at,category,status,code,route,message').order('occurred_at', { ascending: false })));
  return { sections, students, learning: learning.rows, learningAvailable: learning.available, bkt: bkt.rows, bktAvailable: bkt.available, operations: operations.rows.slice(0, 200), operationsAvailable: operations.available };
}
export async function developerSnapshot(db, query, now) {
  return buildDeveloperSnapshot(await fetchDeveloperInputs(db), parseFilters(query), now);
}
