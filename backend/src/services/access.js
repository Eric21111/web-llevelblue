import { mapLearner } from './learning.js';
export const fail = (status, message) => Object.assign(new Error(message), { status });
export async function result(query) { const {data,error} = await query; if(error) throw error; return data; }
// Supabase limits a response to a page; summaries and exports must include every page.
export async function allRows(query) {
  const rows=[];
  for(let offset=0;;offset+=500) {
    const page=await result(query.range(offset,offset+499));
    rows.push(...page);
    if(page.length<500) return rows;
  }
}
export async function rowsForIds(db,table,column,ids,columns='*') {
  const rows=[];
  for(let offset=0;offset<ids.length;offset+=100) rows.push(...await allRows(db.from(table).select(columns).in(column,ids.slice(offset,offset+100)).order(column).order(table==='bkt_records'?'topic':'id')));
  return rows;
}
export const staffOnly = (req,res,next) => ['admin','super'].includes(req.user?.role) && req.user.status === 'Active' ? next() : res.status(403).json({error:'An active staff account is required.'});
export const headOnly = (req,res,next) => req.user?.role === 'super' && req.user.status === 'Active' ? next() : res.status(403).json({error:'School-head access is required.'});
export const handler = fn => async (req,res,next) => { try { await fn(req,res); } catch(e) { next(e); } };
export async function sectionScope(db, user, filters = {}) {
  if (!['admin','super'].includes(user?.role)) throw fail(403,'Staff access is required.');
  let sections = await allRows(db.from('sections').select('*').order('id'));
  if(user.role === 'admin') {
    const assignments = await allRows(db.from('teacher_sections').select('section_id').eq('teacher_id',String(user.id)).order('section_id'));
    const ids = new Set(assignments.map(a => a.section_id));
    sections = sections.filter(s => ids.has(s.scope_id));
  }
  if(filters.sectionId) {
    if(!sections.some(s => s.scope_id === filters.sectionId)) throw fail(403,'This section is not available to your account.');
    sections = sections.filter(s => s.scope_id === filters.sectionId);
  }
  if(filters.grade && !['Grade 11','Grade 12'].includes(filters.grade)) throw fail(400,'Choose Grade 11 or Grade 12.');
  if(filters.grade) sections = sections.filter(s => s.grade_level === filters.grade);
  return sections;
}
export async function learners(db,user,filters = {}) {
  const sections = await sectionScope(db,user,filters);
  let query = db.from('students').select('*');
  if(user.role !== 'super' || filters.sectionId || filters.grade) {
    if(!sections.length) return {sections,students:[]};
    query = query.in('section_id',sections.map(s=>s.scope_id));
  }
  const rows = await allRows(query.order('id'));
  const records = await rowsForIds(db,'bkt_records','student_id',rows.map(s=>s.id));
  const sectionGrades=new Map(sections.map(s=>[s.scope_id,s.grade_level]));
  // Legacy enrollment may have no grade. Use the head-confirmed section grade for
  // display/filtering without rewriting student records or learning history.
  const students=rows.map(s=>mapLearner({...s,grade_level:s.grade_level?.trim() || sectionGrades.get(s.section_id) || null},records));
  return {sections,students:students.filter(s=>!filters.grade || s.gradeLevel===filters.grade)};
}
export function requireLearner(students,id) { const student=students.find(s=>String(s._id)===String(id)); if(!student) throw fail(404,'Student not available in your sections.'); return student; }
