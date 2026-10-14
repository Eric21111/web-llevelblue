import {allRows,fail} from './access.js';
export async function teacherOversight(db,filters={}) {
 const days=Number(filters.days||30);if(![7,30,90].includes(days))throw fail(400,'Choose 7, 30 or 90 days.');
 const since=new Date(Date.now()-days*86400000).toISOString();
 const [teachers,assignments,sections,actions,bounties,students]=await Promise.all([
  allRows(db.from('users').select('id,name,status').eq('role','admin').order('id')),
  allRows(db.from('teacher_sections').select('*').order('teacher_id').order('section_id')),
  allRows(db.from('sections').select('*').order('id')),
  allRows(db.from('staff_events').select('*').order('created_at').order('id')),
  allRows(db.from('support_bounties').select('id,mentee_id,created_by,status,cancelled_at').order('id')),
  allRows(db.from('students').select('id,section_id,enrollment_status').order('id'))]);
 if(filters.sectionId&&!sections.some(s=>s.scope_id===filters.sectionId))throw fail(400,'Unknown section.');
 const recent=actions.filter(e=>e.created_at>=since);
 return {since,days,sections,teachers:teachers.map(t=>{
  const assigned=assignments.filter(a=>a.teacher_id===String(t.id)&&(!filters.sectionId||a.section_id===filters.sectionId)).map(a=>a.section_id);
  const events=recent.filter(e=>e.actor_id===String(t.id)&&assigned.includes(e.details?.section_id));
  const reviews=events.filter(e=>e.event_type==='review'),remediation=events.filter(e=>e.event_type==='remediation'),bountyReviews=events.filter(e=>e.event_type==='bounty-review');
  const related=bounties.filter(b=>!b.cancelled_at&&students.some(s=>String(s.id)===String(b.mentee_id)&&assigned.includes(s.section_id)&&(s.enrollment_status||'active')==='active'));
  return {id:t.id,name:t.name,status:t.status,sections:sections.filter(s=>assigned.includes(s.scope_id)).map(s=>({id:s.scope_id,name:s.name})),reviews:reviews.length,remediation:remediation.length,bountyReviews:bountyReviews.length,outcomeUpdates:events.filter(e=>e.event_type==='intervention-updated').length,lastRecordedAction:events.map(e=>e.created_at).sort().at(-1)||null,
   openBounties:related.filter(b=>['PENDING','AWAITING_LINK','ACCEPTED'].includes(b.status)).length,studentConfirmedBounties:related.filter(b=>b.status==='VALIDATED').length};
 }).filter(t=>!filters.sectionId||t.sections.length),limitation:'Counts reflect documented actions during the selected period in currently assigned sections. No recorded action does not mean no teaching occurred. Bounty counts show current section totals shared by co-teachers, not individual performance.'};
}
