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
