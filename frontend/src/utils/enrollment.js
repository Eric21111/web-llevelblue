export const validAcademicYear=value=>typeof value==='string'&&/^20\d{2}-20\d{2}$/.test(value)&&Number(value.slice(5))===Number(value.slice(0,4))+1;
export function nextAcademicYear(value){
 if(!validAcademicYear(value))return '';
 const next=`${Number(value.slice(0,4))+1}-${Number(value.slice(5))+1}`;
 return validAcademicYear(next)?next:'';
}
export function enrollmentIssue(student,{year,grade,blockedIds=[]}){
 if(student.gradeLevel!==grade)return 'Confirm the recorded grade';
 if(!Number.isInteger(student.enrollmentVersion)||student.enrollmentVersion<0)return 'Reload enlistment details';
 if(blockedIds.includes(String(student._id)))return 'Resolve the active mentor bounty';
 if(student.academicYear&&year&&student.academicYear!==year)return 'Academic year does not match';
 return '';
}

// The confirmed section grade decides the transition. Grade 12 graduates; there is no Grade 13.
export const transitionForGrade=grade=>grade==='Grade 11'?'promote':grade==='Grade 12'?'graduate':null;
export const transitionLabel=action=>action==='promote'?'Promote to Grade 12':action==='graduate'?'Graduate':'';
export const sourceGrade=action=>action==='promote'?'Grade 11':action==='graduate'?'Grade 12':'';

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
  title:promote?'Review promotion':'Review graduation',
  transition:transitionLabel(review.action),
  from:`${sourceName} · ${sourceGrade(review.action)} / ${review.fromYear}`,
  to:promote?`${targetName} · Grade 12 / ${review.toYear}`:`Graduated · ${review.fromYear}`,
  confirm:promote?'Confirm promotion':'Confirm graduation',
 };
}

export const SCHEDULE_STATUS={pending:'Pending',completed:'Completed',failed:'Failed',cancelled:'Cancelled'};
export const PLAN_STATUS={pending:'Scheduled',completed:'Completed',partial:'Completed with failures',failed:'Failed',cancelled:'Cancelled'};
const SKIP_REASONS={'not-found':'Student record not found',moved:'Moved to another section','enrollment-changed':'Enlistment changed after scheduling','grade-mismatch':'Student grade differs from the section grade','year-mismatch':'Recorded in a different school year','active-mentor-bounty':'Active mentor bounty','unconfirmed-grade':'Section grade not confirmed','no-section':'No section assigned'};
export const skipReasonLabel=code=>SKIP_REASONS[code]||(typeof code==='string'&&code.startsWith('already-')?`Already ${code.slice(8)}`:'Not eligible');

// The server preview groups learners by authoritative section grade; these helpers only summarise it.
export function advancementOverview(preview){
 const sections=preview?.sections||[];
 const promoting=sections.filter(s=>s.action==='promote'&&s.students.length),graduating=sections.filter(s=>s.action==='graduate'&&s.students.length);
 const count=list=>list.reduce((total,s)=>total+s.students.length,0);
 const excluded=[...sections.flatMap(s=>s.excluded.map(x=>({...x,sectionName:s.name}))),...(preview?.unconfirmed||[]).map(x=>({...x,sectionName:x.sectionName||'No section'}))];
 return {promoting,graduating,promoteCount:count(promoting),graduateCount:count(graduating),included:count(promoting)+count(graduating),excluded,oversized:sections.filter(s=>s.students.length>500)};
}
export function missingDestinations(preview,destinations={}){
 const valid=new Set((preview?.destinations||[]).map(d=>d.id));
 return advancementOverview(preview).promoting.filter(s=>!valid.has(destinations[s.id]));
}
export function advancementIssues({preview,year,runOn,destinations={},legacyCount=0},now=new Date()){
 const issues=[];
 if(legacyCount)issues.push('Cancel the remaining individual section schedules first.');
 if(!validAcademicYear(year))issues.push('Enter the current school year, such as 2026-2027.');
 const dateIssue=scheduleDateIssue(runOn,now);
 if(dateIssue)issues.push(dateIssue);
 if(!preview||!validAcademicYear(year)||preview.fromYear!==year)return [...issues,'Load the students for this school year.'];
 const overview=advancementOverview(preview);
 if(!overview.included)issues.push('No eligible Grade 11 or Grade 12 students for this school year.');
 if(overview.promoting.length&&!preview.destinations.length)issues.push('Create a Grade 12 section before promoting Grade 11 students.');
 else{const missing=missingDestinations(preview,destinations);if(missing.length)issues.push(`Choose a Grade 12 destination for ${missing.map(s=>s.name).join(', ')}.`);}
 for(const section of overview.oversized)issues.push(`${section.name} has more than 500 students. Split it before scheduling.`);
 return issues;
}
export function advancementRequest(preview,{runOn,destinations={}}){
 const overview=advancementOverview(preview);
 return {fromYear:preview.fromYear,runOn,destinations:Object.fromEntries(overview.promoting.map(s=>[s.id,destinations[s.id]])),
  students:[...overview.promoting,...overview.graduating].flatMap(s=>s.students.map(x=>({id:x.id,version:x.version})))};
}
