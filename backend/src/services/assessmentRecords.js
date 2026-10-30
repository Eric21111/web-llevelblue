import {fail,learners,rowsForIds} from './access.js';
import {csvCell} from './reports.js';

export async function assessmentRecords(db,user,filters={}){
 const scope=await learners(db,user,filters);
 const students=filters.studentId?scope.students.filter(s=>String(s._id)===String(filters.studentId)):scope.students;
 if(filters.studentId&&!students.length)throw fail(403,'This learner is not available to your account.');
 if(filters.kind&&!['pretest','posttest'].includes(filters.kind))throw fail(400,'Choose pre-test or post-test.');
 if(filters.moduleId&&!/^mod_0[1-5]$/.test(filters.moduleId))throw fail(400,'Choose a valid module.');
 const rows=await rowsForIds(db,'learning_records','student_id',students.map(s=>String(s._id)));
 return {students,records:rows.filter(r=>['pretest','posttest'].includes(r.kind)&&(!filters.kind||r.kind===filters.kind)&&(!filters.moduleId||r.module_id===filters.moduleId)).sort((a,b)=>String(b.occurred_at).localeCompare(String(a.occurred_at))||String(a.id).localeCompare(String(b.id)))};
}
export function assessmentCsv({students,records}){
 const rows=[['Student ID','Student','Section','Grade','Assessment ID','Assessment','Module','Instrument','Completed','Occurred at','Received at','Correct','Total','Score (%)','Evidence source','Question ID','Question','Options','Student answer','Correct answer','Result','Response coverage']];
 for(const r of records){
  const student=students.find(s=>String(s._id)===String(r.student_id));
  const base=[r.student_id,student?.name,student?.section,student?.gradeLevel,r.id,r.kind,r.module_id,r.data.instrument,r.data.completed,r.occurred_at,r.received_at,r.data.correct,r.data.total,r.data.score,r.data.source];
  const responses=Array.isArray(r.data.responses)?r.data.responses:[];
  if(!responses.length)rows.push([...base,'','','','','','','Answers were not recorded for this attempt']);
  for(const item of responses)rows.push([...base,item.question_id,item.prompt,(item.options||[]).join(' | '),item.selected_answer,item.correct_answer,item.correct===true?'Correct':item.correct===false?'Incorrect':'Unscored',`${responses.length} of ${r.data.total} responses`]);
 }
 return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
