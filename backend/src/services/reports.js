import PDFDocument from 'pdfkit';
import { TOPICS, topicSummary } from './learning.js';
import { fail } from './access.js';
export function csvCell(value) {
  let text=value===null||value===undefined?'':String(value);
  if(/^\s*[=+@\-]/.test(text)||/^[\t\r]/.test(text)) text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function pairedSummaries(students) {
  const paired=students.filter(s=>s.gain!==null);
  return [...new Set(paired.map(s=>s.preAssessment.scale))].map(scale=>{
    const group=paired.filter(s=>s.preAssessment.scale===scale);
    const mean=key=>group.reduce((sum,s)=>sum+s[key],0)/group.length;
    return {scale,count:group.length,pre:mean('pre'),post:mean('post'),gain:mean('gain')};
  });
}
export function reportRows(data,filters,generatedAt) {
  const rows=[['LEVELBLUE learning evidence report'],['Generated',generatedAt],['Grade',filters.grade||'All available grades'],['Section',data.sections.find(s=>s.scope_id===filters.sectionId)?.name||'All authorized sections'],['Learners',data.students.length],['Student feedback responses',data.feedback.length],['Confirmed pre-tests',data.students.filter(s=>s.preAssessment.confirmed).length],['Confirmed post-tests',data.students.filter(s=>s.postAssessment.confirmed).length],['Comparable pairs',data.students.filter(s=>s.gain!==null).length],['Limitations','Unconfirmed legacy scores are shown without gains. Blank mastery means unassessed. Simulation clearance, completion rates and historical trends are unavailable. This is not accreditation certification.'],[],['Topic','Assessed','Unassessed','Below 0.40','Support proportion','Mean recorded BKT']];
  topicSummary(data.students).forEach(t=>rows.push([t.topic,t.assessed,t.unassessed,t.support,t.supportProportion,t.mastery]));
  rows.push([],['Comparable assessment scale','Pairs','Mean pre','Mean post','Mean gain']);
  pairedSummaries(data.students).forEach(g=>rows.push([g.scale,g.count,g.pre,g.post,g.gain]));
  rows.push([],['Student ID','Name','Grade','Section','Pre score','Pre confirmed','Post score','Post confirmed','Comparable scale','Gain',...TOPICS]);
  data.students.forEach(s=>rows.push([s._id,s.name,s.gradeLevel,s.section,s.pre,s.preAssessment.confirmed,s.post,s.postAssessment.confirmed,s.gain!==null?s.preAssessment.scale:null,s.gain,...TOPICS.map(t=>s.mastery[t])]));
  rows.push([],['Student ID','Action','Topic','Note','Scheduled','Outcome','Actor ID','Recorded','Updated','Updated by','Bounty ID']);
  data.interventions.forEach(i=>rows.push([i.student_id,i.kind,i.topic,i.note,i.scheduled_date,i.outcome,i.actor_id,i.created_at,i.updated_at,i.updated_by,i.bounty_id]));
  return rows;
}
export function exportReport(req,res,data) {
  const format=req.query.format||'pdf';
  if(!['pdf','csv'].includes(format)) throw fail(400,'Choose PDF or CSV.');
  const generatedAt=new Date().toISOString();
  const rows=reportRows(data,req.query,generatedAt);
  res.setHeader('Cache-Control','no-store');
  res.attachment(`LEVELBLUE-${req.params.kind}-${generatedAt.slice(0,10)}.${format}`);
  if(format==='csv') {res.type('text/csv');return res.send('\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'));}
  res.type('application/pdf');
  const doc=new PDFDocument({margin:48,size:'A4',info:{Title:'LEVELBLUE learning evidence report'}});
  doc.on('error',()=>res.destroy());doc.pipe(res);
  doc.fontSize(20).fillColor('#19453f').text('LEVELBLUE');
  doc.fontSize(15).text('Learning evidence report').moveDown();
  doc.fontSize(10).fillColor('#172c32');
  rows.slice(1,10).forEach(r=>doc.text(`${r[0]}: ${r[1]}`).moveDown(.4));
  doc.moveDown().fontSize(13).text('Topic summary').fontSize(10);
  topicSummary(data.students).forEach(t=>doc.text(`${t.topic}: ${t.assessed} assessed, ${t.unassessed} unassessed; ${t.support} below 0.40 (${t.supportProportion===null?'not available':Math.round(t.supportProportion*100)+'% of assessed'}). Mean BKT: ${t.mastery===null?'unavailable':t.mastery.toFixed(3)}.`).moveDown(.4));
  doc.moveDown().fontSize(13).text('Paired assessment outcomes').fontSize(10);
  const groups=pairedSummaries(data.students);
  if(!groups.length) doc.text('No confirmed comparable pairs. Learning gains are unavailable.');
  groups.forEach(g=>doc.text(`${g.scale}: ${g.count} pairs. Mean pre ${g.pre.toFixed(2)}, mean post ${g.post.toFixed(2)}, mean gain ${g.gain.toFixed(2)}.`).moveDown(.4));
  data.students.forEach(s=>{
    doc.addPage().fontSize(15).text(s.name).fontSize(10).text(`Student ID: ${s._id}`).text(`${s.gradeLevel||'Grade unconfirmed'} | ${s.section||'Section unassigned'}`).moveDown();
    doc.text(`Pre-test: ${s.pre??'unavailable'} (${s.preAssessment.confirmed?'confirmed':'unconfirmed'})`).text(`Post-test: ${s.post??'unavailable'} (${s.postAssessment.confirmed?'confirmed':'unconfirmed'})`).text(`Comparable gain: ${s.gain??'unavailable'}${s.gain!==null?' | scale: '+s.preAssessment.scale:''}`).moveDown();
    TOPICS.forEach(t=>doc.text(`${t}: ${s.mastery[t]===null?'unassessed':s.mastery[t].toFixed(3)}`));
    doc.moveDown().text('Documented interventions');
    const notes=data.interventions.filter(i=>i.student_id===String(s._id));
    if(!notes.length) doc.text('No recorded action. This does not establish that no teaching work occurred.');
    notes.forEach(i=>doc.moveDown().text(`${i.kind} | ${i.topic} | ${i.outcome}`).text(`Recorded: ${i.created_at} | Actor: ${i.actor_id}`).text(`Updated: ${i.updated_at || i.created_at} | By: ${i.updated_by || i.actor_id}`).text(`Scheduled: ${i.scheduled_date||'Not scheduled'}`).text(i.note));
  });
  doc.end();
}
