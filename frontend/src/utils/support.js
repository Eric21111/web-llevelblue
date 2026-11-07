import {SKILLS,studentId} from './dashboard.js';

export const ACTION_LABELS = {review:'Learning review',remediation:'Classroom support','bounty-review':'Mentor review'};
export const OUTCOMES = ['Pending','In progress','Completed','Follow-up needed'];
export const recordedTopics = student => SKILLS.filter(topic => typeof student.mastery?.[topic] === 'number' && Number.isFinite(student.mastery[topic]));
export const supportTopics = student => recordedTopics(student).filter(topic => student.mastery[topic] < .4);
export const latestActions = notes => {
 const latest=new Map();
 for(const note of notes) {const id=String(note.student_id),previous=latest.get(id);if(!previous||Date.parse(note.created_at)>Date.parse(previous.created_at))latest.set(id,note);}
 return latest;
};
export function filterLearners(students,{section='',grade='',query='',topic='',need='all'}={}) {
 return students.filter(student => (!section || student.sectionId===section) && (!grade || student.gradeLevel===grade)
  && `${student.name||''} ${student.section||''}`.toLowerCase().includes(query.trim().toLowerCase())
  && (!topic || supportTopics(student).includes(topic))
  && (need==='support'?supportTopics(student).length>0:need==='unassessed'?recordedTopics(student).length===0:true));
}
export const STUDENT_GRADES = ['Grade 11','Grade 12'];
export const sectionsForGrade = (sections,grade) => STUDENT_GRADES.includes(grade) ? sections.filter(s => s.gradeLevel===grade) : [];
export const unconfirmedSections = sections => sections.filter(s => !STUDENT_GRADES.includes(s.gradeLevel));
export const noSectionsMessage = grade => `No sections available for ${grade}.`;
export const placementSection = (sections,grade,sectionId) => sectionsForGrade(sections,grade).find(s => s.id===sectionId) || null;
export function newStudentPlacement(sections,{grade='',sectionId=''}={}) {
 const preset=sections.find(s => s.id===sectionId && STUDENT_GRADES.includes(s.gradeLevel));
 const gradeLevel=preset?.gradeLevel || (STUDENT_GRADES.includes(grade) ? grade : '');
 return {gradeLevel,sectionId:preset?.id||''};
}
export const reviewPath = student => `/interventions?${new URLSearchParams({studentId:studentId(student),topic:supportTopics(student)[0]||''})}`;
export function filterSupportActions(notes,students,sections,{section='',grade='',query=''}={}) {
 const search=query.trim().toLowerCase();
 return notes.filter(note=>{
  const originalSection=sections.find(s=>s.id===note.section_id);
  const learner=students.find(s=>studentId(s)===String(note.student_id));
  return (!section||note.section_id===section)&&(!grade||originalSection?.gradeLevel===grade)
   && (!search||`${learner?.name||'Former / unavailable learner'} ${originalSection?.name||''}`.toLowerCase().includes(search));
 });
}
