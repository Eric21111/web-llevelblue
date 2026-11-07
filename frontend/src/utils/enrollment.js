export const validAcademicYear=value=>typeof value==='string'&&/^20\d{2}-20\d{2}$/.test(value)&&Number(value.slice(5))===Number(value.slice(0,4))+1;
export function nextAcademicYear(value){
 if(!validAcademicYear(value))return '';
 const next=`${Number(value.slice(0,4))+1}-${Number(value.slice(5))+1}`;
 return validAcademicYear(next)?next:'';
}
export function enrollmentIssue(student,{year,grade,blockedIds=[]}){
 if(student.gradeLevel!==grade)return 'Confirm the recorded grade';
 if(!Number.isInteger(student.enrollmentVersion)||student.enrollmentVersion<0)return 'Reload enrollment details';
 if(blockedIds.includes(String(student._id)))return 'Resolve the active mentor bounty';
 if(student.academicYear&&year&&student.academicYear!==year)return 'Academic year does not match';
 return '';
}

// The confirmed section grade decides the transition. Grade 12 graduates; there is no Grade 13.
export const transitionForGrade=grade=>grade==='Grade 11'?'promote':grade==='Grade 12'?'graduate':null;
export const transitionLabel=action=>action==='promote'?'Promote to Grade 12':action==='graduate'?'Graduate':'';
export const sourceGrade=action=>action==='promote'?'Grade 11':action==='graduate'?'Grade 12':'';
export const scheduleDateLabel=action=>action==='promote'?'Promotion Date':'Graduation Date';

export const SCHEDULE_TIMEZONE='Asia/Manila';
export const SCHEDULE_MAX_DAYS=400;
export function manilaToday(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:SCHEDULE_TIMEZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function addDays(isoDate,days){
 const date=new Date(`${isoDate}T00:00:00Z`);
 date.setUTCDate(date.getUTCDate()+days);
 return date.toISOString().slice(0,10);
}
const realDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
export function scheduleDateIssue(value,now=new Date()){
 if(!value)return 'Choose a date.';
 if(!realDate(value))return 'Choose a valid date.';
 const today=manilaToday(now);
 if(value<=today)return 'Choose a date after today (Asia/Manila).';
 if(value>addDays(today,SCHEDULE_MAX_DAYS))return `Choose a date within the next ${SCHEDULE_MAX_DAYS} days.`;
 return '';
}
export function formatScheduleDate(isoDate){
 return realDate(isoDate)?new Intl.DateTimeFormat('en-PH',{timeZone:'UTC',dateStyle:'long'}).format(new Date(`${isoDate}T00:00:00Z`)):'';
}

export function reviewSummary(review,{sourceName='',targetName=''}={}){
 const promote=review.action==='promote';
 return {
  title:review.scheduled?(promote?'Review scheduled promotion':'Review scheduled graduation'):(promote?'Review promotion':'Review graduation'),
  transition:transitionLabel(review.action),
  from:`${sourceName} · ${sourceGrade(review.action)} / ${review.fromYear}`,
  to:promote?`${targetName} · Grade 12 / ${review.toYear}`:`Graduated · ${review.fromYear}`,
  when:review.scheduled?`${scheduleDateLabel(review.action)}: ${formatScheduleDate(review.runOn)} (${SCHEDULE_TIMEZONE})`:'Applies immediately when you confirm',
  confirm:review.scheduled?'Confirm schedule':promote?'Confirm promotion':'Confirm graduation',
 };
}

export function scheduleRequest(review){
 return {action:review.action,sourceId:review.sourceId,targetId:review.action==='promote'?review.targetId:null,fromYear:review.fromYear,runOn:review.runOn,students:review.students};
}

export const SCHEDULE_STATUS={pending:'Pending',completed:'Completed',failed:'Failed',cancelled:'Cancelled'};
