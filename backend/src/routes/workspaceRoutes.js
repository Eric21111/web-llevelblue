import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { fail, result, allRows, rowsForIds, handler, staffOnly, headOnly, sectionScope, learners, requireLearner } from '../services/access.js';
import { TOPICS, topicSummary, mapLearner } from '../services/learning.js';
import { exportReport } from '../services/reports.js';
import { attachLearningEvidence, RECORD_LIMITATION } from '../services/learningRecords.js';

export function createWorkspaceRoutes(db) {
  const router=express.Router();
  router.use(staffOnly);
  router.get('/sections',handler(async(req,res)=>res.json((await sectionScope(db,req.user)).map(s=>({...s,id:s.scope_id,gradeLevel:s.grade_level,createdAt:s.created_at})))));
  router.post('/sections',handler(async(req,res)=>{
    const {name,subject='General Cybersecurity',gradeLevel}=req.body;
    if(typeof name!=='string' || !name.trim() || name.length>100 || !['Grade 11','Grade 12'].includes(gradeLevel)) throw fail(400,'Section name and Grade 11 or Grade 12 are required.');
    const data=await result(db.rpc('levelblue_create_section',{p_actor:String(req.user.id),p_name:name.trim(),p_subject:String(subject).slice(0,200),p_grade:gradeLevel}));
    res.status(201).json({...data,id:data.scope_id,gradeLevel:data.grade_level});
  }));
  router.patch('/sections/:id',headOnly,handler(async(req,res)=>{
    const {gradeLevel}=req.body;
    if(!['Grade 11','Grade 12'].includes(gradeLevel)) throw fail(400,'Choose Grade 11 or Grade 12.');
    const section=await result(db.from('sections').select('scope_id,grade_level').eq('scope_id',req.params.id).maybeSingle());
    if(!section) throw fail(404,'Section not found. Refresh the section list and try again.');
    if(section.grade_level && section.grade_level!==gradeLevel) throw fail(409,`This section is already confirmed as ${section.grade_level}. Changing its grade requires cohort promotion.`);
    const rows=await allRows(db.from('students').select('grade_level').eq('section_id',req.params.id).order('id'));
    const conflicts=rows.filter(s=>s.grade_level?.trim() && s.grade_level.trim()!==gradeLevel);
    if(conflicts.length) throw fail(409,`Cannot confirm ${gradeLevel}: ${conflicts.length} enrolled student(s) have a different recorded grade (${[...new Set(conflicts.map(s=>s.grade_level.trim()))].join(', ')}). Check their enrollment before confirming the section.`);
    const data=await result(db.from('sections').update({grade_level:gradeLevel}).eq('scope_id',req.params.id).select().single());
    res.json(data);
  }));
  router.delete('/sections/:id',(req,res)=>res.status(409).json({error:'Section removal is disabled to preserve enrollment and feedback history. Cohort archival will be introduced with promotion.'}));
  router.get('/students',handler(async(req,res)=>res.json((await learners(db,req.user,req.query)).students)));
  router.post('/students',handler(async(req,res)=>{
    const {firstName,lastName,middleName='',email,technical}=req.body;
    if(![firstName,lastName,email].every(v=>typeof v==='string'&&v.trim())) throw fail(400,'First name, last name and email are required.');
    const sections=await sectionScope(db,req.user);
    const section=sections.find(s=>req.body.sectionId ? s.scope_id===req.body.sectionId : s.name===req.body.section);
    if(!section) throw fail(403,'Choose an assigned section.');
    if(!section.grade_level) throw fail(409,'Ask your school head to confirm this section’s grade first.');
    if(req.body.gradeLevel && req.body.gradeLevel!==section.grade_level) throw fail(400,'Student grade must match the section.');
    const generatedPassword=randomBytes(9).toString('base64url');
    const row=await result(db.from('students').insert({name:`${firstName.trim()} ${middleName ? middleName.trim()[0]+'. ' : ''}${lastName.trim()}`,first_name:firstName.trim(),last_name:lastName.trim(),middle_initial:middleName.trim()[0]||null,
      email:email.trim().toLowerCase(),password:await bcrypt.hash(generatedPassword,10),requires_password_change:true,
      section:section.name,section_id:section.scope_id,grade_level:section.grade_level,technical:Boolean(technical),status:'Needs Review',pre:0,post:0,sessions:0,points:0,
      ...Object.fromEntries(TOPICS.map(t=>[`mastery_${t.toLowerCase()}`,0]))}).select().single());
    res.status(201).json({...mapLearner(row),generatedPassword});
  }));
  router.delete('/students/:id',handler(async(req,res)=>{
    requireLearner((await learners(db,req.user)).students,req.params.id);
    throw fail(409,'Student deletion is disabled to preserve learning history. Graduation and archival are pending mobile compatibility verification.');
  }));
  router.get('/students/:id/mentors',handler(async(req,res)=>{
    const {students}=await learners(db,req.user); const student=requireLearner(students,req.params.id);
    res.json({mentors:students.filter(s=>s._id!==student._id&&s.sectionId&&s.sectionId===student.sectionId).map(s=>({id:s._id,name:s.name,topics:student.failedTopics.filter(t=>s.mastery[t]!==null&&s.mastery[t]>.9)})).filter(s=>s.topics.length)});
  }));
  router.get('/teachers',headOnly,handler(async(req,res)=>{
    const [teachers,assignments,students,sections]=await Promise.all([allRows(db.from('users').select('id,name,first_name,last_name,middle_initial,email,status,created_at').eq('role','admin').order('id')),allRows(db.from('teacher_sections').select('*').order('teacher_id').order('section_id')),allRows(db.from('students').select('section_id').order('id')),allRows(db.from('sections').select('*').order('id'))]);
    res.json(teachers.map(t=>{const ids=assignments.filter(a=>a.teacher_id===String(t.id)).map(a=>a.section_id);return {...t,_id:t.id,firstName:t.first_name,lastName:t.last_name,middleInitial:t.middle_initial,role:'admin',roleLabel:'Teacher',createdAt:t.created_at,sectionIds:ids,sections:ids.length,students:students.filter(s=>ids.includes(s.section_id)).length,grades:[...new Set(sections.filter(s=>ids.includes(s.scope_id)).map(s=>s.grade_level).filter(Boolean))]};}));
  }));
  router.patch('/teachers/:id',headOnly,handler(async(req,res)=>{
    if(!['Active','Inactive','Invited'].includes(req.body.status)||!Array.isArray(req.body.sectionIds)||!req.body.sectionIds.every(s=>typeof s==='string')) throw fail(400,'Valid status and section assignments are required.');
    await result(db.rpc('levelblue_faculty',{p_actor:String(req.user.id),p_teacher:req.params.id,p_status:req.body.status,p_sections:req.body.sectionIds}));
    res.json({success:true});
  }));
  router.delete('/teachers/:id',headOnly,(req,res)=>res.status(409).json({error:'Deactivate the teacher to preserve assignment and review history.'}));
  router.get('/analytics/at-risk',handler(async(req,res)=>res.json((await learners(db,req.user,req.query)).students.filter(s=>s.failedTopics.length).map(s=>({...s,id:s._id,weakTopics:s.failedTopics,failingSkills:s.failedTopics})))));
  router.get('/analytics',handler(async(req,res)=>{
    const data=await attachLearningEvidence(db,await learners(db,req.user,req.query));
    res.json({...data,topics:topicSummary(data.students),comparisons:data.sections.map(s=>({id:s.scope_id,name:s.name,grade:s.grade_level,topics:topicSummary(data.students.filter(l=>l.sectionId===s.scope_id))})),grades:['Grade 11','Grade 12'].map(grade=>({grade,topics:topicSummary(data.students.filter(s=>s.gradeLevel===grade))})),limitations:[RECORD_LIMITATION,'Legacy scores without completion metadata are unconfirmed; learning gains require paired assessments on the same scale.']});
  }));
  router.get('/interventions',handler(async(req,res)=>{
    const {sections,students}=await learners(db,req.user,req.query);
    if(req.query.studentId) requireLearner(students,req.query.studentId);
    let query=db.from('learning_interventions').select('*').in('section_id',sections.map(s=>s.scope_id));
    if(!sections.length) return res.json([]);
    if(req.query.studentId) query=query.eq('student_id',req.query.studentId);
    res.json(await allRows(query.order('created_at',{ascending:false}).order('id')));
  }));
  router.post('/interventions',handler(async(req,res)=>{
    const student=requireLearner((await learners(db,req.user)).students,req.body.studentId);
    if(!student.sectionId) throw fail(409,'Resolve this student’s section before recording interventions.');
    const {kind,topic,note,scheduledDate,outcome='Pending',bountyId}=req.body;
    if(!['review','remediation','bounty-review'].includes(kind)||!TOPICS.includes(topic)||typeof note!=='string'||!note.trim()||note.length>5000||!['Pending','In progress','Completed','Follow-up needed'].includes(outcome)) throw fail(400,'Choose a topic, action, outcome and a note (up to 5,000 characters).');
    if(kind==='remediation' && (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate||'')||!Number.isFinite(Date.parse(scheduledDate)))) throw fail(400,'A valid scheduled date is required for remediation.');
    if(kind==='bounty-review') {
      const bounty=await result(db.from('support_bounties').select('*').eq('id',bountyId).maybeSingle());
      if(!bounty||String(bounty.mentee_id)!==String(student._id)) throw fail(404,'Bounty not available for this student.');
    }
    res.status(201).json(await result(db.from('learning_interventions').insert({student_id:String(student._id),section_id:student.sectionId,actor_id:String(req.user.id),kind,topic,note:note.trim(),scheduled_date:kind==='remediation'?scheduledDate:null,outcome,bounty_id:kind==='bounty-review'?String(bountyId):null}).select().single()));
  }));
  router.patch('/interventions/:id',handler(async(req,res)=>{
    const row=await result(db.from('learning_interventions').select('*').eq('id',req.params.id).maybeSingle());
    const sections=await sectionScope(db,req.user);
    if(!row||!sections.some(s=>s.scope_id===row.section_id)) throw fail(404,'Intervention not available.');
    if(!['Pending','In progress','Completed','Follow-up needed'].includes(req.body.outcome)) throw fail(400,'Choose a valid outcome.');
    res.json(await result(db.from('learning_interventions').update({outcome:req.body.outcome,updated_by:String(req.user.id),updated_at:new Date().toISOString()}).eq('id',row.id).select().single()));
  }));
  router.get('/reports/:kind',handler(async(req,res)=>{
    if(!['institutional','individual'].includes(req.params.kind)) throw fail(404,'Report not found.');
    if(req.params.kind==='institutional'&&req.user.role!=='super') throw fail(403,'Institutional reports are for school heads.');
    const data=await learners(db,req.user,req.query);
    if(req.params.kind==='individual') data.students=[requireLearner(data.students,req.query.studentId)];
    const ids=data.students.map(s=>String(s._id));
    data.interventions=await rowsForIds(db,'learning_interventions','student_id',ids);
    const allowed=new Set(data.sections.map(s=>s.scope_id));
    data.interventions=data.interventions.filter(i=>allowed.has(i.section_id));
    data.feedback=(await rowsForIds(db,'feedback','student_id',ids,'student_id,section_id,respondent_role')).filter(f=>f.respondent_role==='student');
    data.feedback=data.feedback.filter(f=>allowed.has(f.section_id));
    exportReport(req,res,await attachLearningEvidence(db,data));
  }));
  return router;
}
