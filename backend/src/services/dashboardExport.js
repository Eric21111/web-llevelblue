import PDFDocument from 'pdfkit';
import {allRows, fail, learners, rowsForIds} from './access.js';
import {TOPICS, topicSummary} from './learning.js';
import {summarizeEvidence} from './learningRecords.js';
import {csvCell} from './reports.js';

export const DASHBOARD_DATE_NOTE = 'The selected period filters recorded learning activity, feedback and reviews. Enrollment, faculty and current mastery are live totals at generation time, not a historical snapshot. Records follow current section access. Missing activity does not prove no learning occurred.';

export function dashboardDay(query) {
  const {date, startOffset, endOffset, period='day'} = query;
  if(!['day','month','year'].includes(period)) throw fail(400,'Choose day, month or year.');
  if(typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail(400,'Choose a valid export date.');
  const midnight = Date.parse(`${date}T00:00:00Z`);
  if(!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0,10) !== date) throw fail(400,'Choose a valid export date.');
  const offset = value => {
    if(typeof value !== 'string' || !/^-?\d+$/.test(value) || Number(value)<-840 || Number(value)>720) throw fail(400,'A valid local timezone offset is required.');
    return Number(value);
  };
  const anchor=new Date(midnight),year=anchor.getUTCFullYear(),month=anchor.getUTCMonth();
  const first=period==='year'?Date.UTC(year,0,1):period==='month'?Date.UTC(year,month,1):midnight;
  const last=period==='year'?Date.UTC(year+1,0,1):period==='month'?Date.UTC(year,month+1,1):midnight+86400000;
  const start = first + offset(startOffset)*60000;
  const end = last + offset(endOffset)*60000;
  if(Math.abs((end-start)-(last-first))>3600000) throw fail(400,'Invalid local period boundaries.');
  if(start>Date.now()) throw fail(400,'Choose today or an earlier date.');
  return {date:period==='year'?date.slice(0,4):period==='month'?date.slice(0,7):date,start:new Date(start).toISOString(),end:new Date(end).toISOString()};
}

export async function dashboardData(db,user,query) {
  const day=dashboardDay(query);
  if(query.sectionName!==undefined && (typeof query.sectionName!=='string'||query.sectionName.length>200)) throw fail(400,'Invalid section selection.');
  const data=await learners(db,user,{sectionId:query.sectionId});
  if(query.sectionName) {
    data.sections=data.sections.filter(s=>s.name===query.sectionName);
    if(!data.sections.length) throw fail(403,'This section is not available to your account.');
    const ids=new Set(data.sections.map(s=>s.scope_id));
    data.students=data.students.filter(s=>ids.has(s.sectionId));
  }
  const ids=data.students.map(s=>String(s._id)), allowed=new Set(data.sections.map(s=>s.scope_id));
  const [records,feedback,interventions,faculty]=await Promise.all([
    rowsForIds(db,'learning_records','student_id',ids),
    rowsForIds(db,'feedback','student_id',ids),
    rowsForIds(db,'learning_interventions','student_id',ids),
    user.role==='super'?allRows(db.from('users').select('id,status').eq('role','admin').order('id')):Promise.resolve(null),
  ]);
  const inDay=value=>{const time=Date.parse(value);return time>=Date.parse(day.start)&&time<Date.parse(day.end);};
  const selectedRecords=records.filter(r=>inDay(r.occurred_at));
  const evidence=summarizeEvidence(selectedRecords);
  const latest=new Map();
  for(const row of [...evidence.observations].sort((a,b)=>Date.parse(a.occurred_at)-Date.parse(b.occurred_at))) latest.set(`${row.student_id}:${row.data.topic}`,row);
  const dailyTopics=TOPICS.map(topic=>{
    const values=[...latest.values()].filter(r=>r.data.topic===topic).map(r=>r.data.mastery);
    return {topic,assessed:values.length,mastery:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,support:values.filter(v=>v<.4).length};
  });
  return {...data,day,faculty,evidence,dailyTopics,
    feedback:feedback.filter(f=>allowed.has(f.section_id)&&f.respondent_role==='student'&&inDay(f.created_at)),
    interventions:interventions.filter(i=>allowed.has(i.section_id)&&inDay(i.created_at)),
    topics:topicSummary(data.students),recordedLearners:new Set(selectedRecords.map(r=>String(r.student_id))).size,
    generatedAt:new Date().toISOString(),role:user.role,limitation:DASHBOARD_DATE_NOTE};
}

export function dashboardRows(data) {
  const pct=v=>v==null?'Unavailable':`${(v*100).toFixed(1)}%`;
  const name=id=>data.students.find(s=>String(s._id)===String(id))?.name||'Learner';
  const rows=[['LEVELBLUE dashboard export'],['Selected local period',data.day.date],['Period starts (UTC, inclusive)',data.day.start],['Period ends (UTC, exclusive)',data.day.end],['Generated (UTC)',data.generatedAt],['Workspace',data.role==='super'?'School head':'Teacher'],['Scope',data.sections.map(s=>s.name).join(', ')||'No assigned sections'],['Report basis',data.limitation],[],['CURRENT OVERVIEW'],['Active enrollment',data.students.length],['Sections',data.sections.length],['Learners active in last 7 days',data.students.filter(s=>{const t=Date.parse(s.lastActive),now=Date.parse(data.generatedAt);return t<=now&&t>=now-7*86400000;}).length],['Learners needing support',data.students.filter(s=>s.failedTopics.length).length],['Learners with no recorded mastery',data.students.filter(s=>!s.assessedTopics).length]];
  if(data.faculty)rows.push(['Active teachers',data.faculty.filter(t=>t.status==='Active').length],['Pending teacher invitations',data.faculty.filter(t=>t.status==='Invited').length]);
  rows.push([],['CURRENT TOPIC MASTERY'],['Topic','Assessed learners','Unassessed','Below 40%','Mean BKT mastery']);
  data.topics.forEach(t=>rows.push([t.topic,t.assessed,t.unassessed,t.support,pct(t.mastery)]));
  rows.push([],['CURRENT SECTIONS'],['Section','Grade','Learners','Need support']);
  data.sections.forEach(s=>{const group=data.students.filter(l=>l.sectionId===s.scope_id);rows.push([s.name,s.grade_level||'Unconfirmed',group.length,group.filter(l=>l.failedTopics.length).length]);});
  rows.push([],['ACTIVITY IN SELECTED PERIOD'],['Learners with learning records',data.recordedLearners],['Completed assessments',data.evidence.assessments.length],['Cleared attempts',data.evidence.cleared],['Failed attempts',data.evidence.failed],['Started / abandoned without a finished result in this period',data.evidence.incomplete],['Student feedback responses',data.feedback.length],['Reviews and interventions recorded',data.interventions.length],['Evidence note','Device time selects learning records; server creation time selects feedback and reviews. An attempt finished outside this period is not a failure within it. Assessment scores may be mobile-reported.'],[],['MASTERY OBSERVED IN SELECTED PERIOD'],['Topic','Learners observed','Below 40%','Mean last observation']);
  data.dailyTopics.forEach(t=>rows.push([t.topic,t.assessed,t.support,pct(t.mastery)]));
  rows.push([],['ASSESSMENTS IN SELECTED PERIOD'],['Learner','Topic','Assessment','Correct','Total','Score (%)','Device time','Source']);
  data.evidence.assessments.forEach(r=>rows.push([name(r.student_id),r.data.topic,r.data.instrument||r.kind,r.data.correct,r.data.total,r.data.score,r.occurred_at,r.data.source]));
  if(!data.evidence.assessments.length) rows.push(['No completed assessments recorded in this period.']);
  rows.push([],['STAGE OUTCOMES IN SELECTED PERIOD'],['Learner','Module','Stage','Outcome','Device time']);
  data.evidence.attempts.forEach(r=>rows.push([name(r.student_id),r.module_id,r.data.stage,r.data.outcome,r.occurred_at]));
  if(!data.evidence.attempts.length) rows.push(['No stage activity recorded in this period.']);
  return rows;
}

export function exportDashboard(res,data,format) {
  if(!['csv','pdf'].includes(format)) throw fail(400,'Choose PDF or CSV.');
  const rows=dashboardRows(data);
  res.setHeader('Cache-Control','no-store');
  res.attachment(`LEVELBLUE-dashboard-${data.day.date}.${format}`);
  if(format==='csv')return res.type('text/csv').send('\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n'));
  res.type('application/pdf');
  const doc=new PDFDocument({size:'A4',margin:44,bufferPages:true,info:{Title:`LEVELBLUE dashboard - ${data.day.date}`}});
  doc.on('error',()=>res.destroy());doc.pipe(res);
  const width=doc.page.width-88;
  const heading=text=>{doc.font('Helvetica-Bold').fontSize(12).fillColor('#2456aa').text(text,{width}).moveDown(.6);};
  doc.font('Helvetica-Bold').fontSize(22).fillColor('#204b99').text('LEVELBLUE');
  doc.fontSize(16).fillColor('#1c293e').text('Dashboard export').moveDown(.7);
  let tableHeader=null,tableWidths=null;
  const rowHeight=(row,widths,bold=false)=>{
    doc.font(bold?'Helvetica-Bold':'Helvetica').fontSize(8);
    return Math.max(23,...row.map((v,i)=>doc.heightOfString(String(v??'Unavailable'),{width:widths[i]-14,lineGap:2})+13));
  };
  const drawRow=(row,widths,header=false)=>{
    const y=doc.y,height=rowHeight(row,widths,header);let x=44;
    if(header)doc.rect(44,y,width,height).fill('#edf3fc');
    doc.font(header?'Helvetica-Bold':'Helvetica').fontSize(8).fillColor(header?'#24436b':'#36445a');
    row.forEach((v,i)=>{doc.text(String(v??'Unavailable'),x+7,y+6,{width:widths[i]-14,lineGap:2});x+=widths[i];});
    doc.moveTo(44,y+height).lineTo(44+width,y+height).strokeColor('#e5ebf2').lineWidth(.5).stroke();
    doc.x=44;doc.y=y+height;
  };
  for(const row of rows.slice(1)) {
    if(!row.length){doc.moveDown(.7);tableHeader=null;tableWidths=null;continue;}
    const section=row.length===1 && row[0]===row[0].toUpperCase();
    if(section) {if(doc.y>doc.page.height-160)doc.addPage();heading(row[0]);continue;}
    if(['Topic','Section','Learner'].includes(row[0])) {
      tableHeader=row;
      const ratios=row.length===8?[.14,.10,.13,.085,.075,.075,.235,.16]:row.length===5?[.23,.19,.16,.18,.24]:Array(row.length).fill(1/row.length);
      tableWidths=ratios.map(r=>r*width);
      drawRow(row,tableWidths,true);continue;
    }
    if(tableHeader && row.length===tableHeader.length) {
      if(doc.y+rowHeight(row,tableWidths)>doc.page.height-70){doc.addPage();drawRow(tableHeader,tableWidths,true);}
      drawRow(row,tableWidths);continue;
    }
    doc.font('Helvetica').fontSize(9).fillColor('#36445a');
    const text=row.map(v=>v==null?'Unavailable':String(v)).join(': ');
    const height=doc.heightOfString(text,{width,lineGap:3});
    if(doc.y+height>doc.page.height-70)doc.addPage();
    doc.text(text,{width,lineGap:3}).moveDown(.45);
  }
  const pages=doc.bufferedPageRange();
  for(let i=0;i<pages.count;i++){
    doc.switchToPage(i);const bottom=doc.page.margins.bottom;doc.page.margins.bottom=0;
    doc.font('Helvetica').fontSize(8).fillColor('#718098').text(`LEVELBLUE  |  ${data.day.date}  |  Page ${i+1} of ${pages.count}`,44,doc.page.height-35,{width,lineBreak:false});
    doc.page.margins.bottom=bottom;
  }
  doc.end();
}
