import {WorkspaceButton,RefreshButton,SegmentedControl} from '../components/WorkspaceUI';
import {SupportDialog,SupportPagination,useSupportPage} from '../components/SupportUI';
import '../styles/support.css';
import {useEffect,useRef,useState} from 'react';
import {Users,ArrowRight,Check,Info,History,CalendarClock} from 'lucide-react';
import '../styles/cohort-checklist.css';
import {apiRequest} from '../utils/api';
import {useAuth} from '../context/AuthContext';
import {useWorkspaceData} from '../context/WorkspaceDataContext';
import {validAcademicYear,nextAcademicYear,enrollmentIssue,transitionForGrade,transitionLabel,sourceGrade,scheduleDateLabel,scheduleDateIssue,manilaToday,addDays,SCHEDULE_MAX_DAYS,SCHEDULE_TIMEZONE,formatScheduleDate,reviewSummary,scheduleRequest,SCHEDULE_STATUS} from '../utils/enrollment';
export default function CohortChecklist(){
 const [view,setView]=useState('cohort');
 const bulkRef=useRef(null);
 const workspace=useWorkspaceData();
 const principal=useAuth().role==='super';
 const [historySection,setHistorySection]=useState('');
 const [data,setData]=useState(null),[source,setSource]=useState(''),[target,setTarget]=useState(''),[year,setYear]=useState(''),[selected,setSelected]=useState([]),[review,setReview]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const [scheduled,setScheduled]=useState(false),[runOn,setRunOn]=useState(''),[schedules,setSchedules]=useState(null),[scheduleError,setScheduleError]=useState(''),[cancelling,setCancelling]=useState(null);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');setSelected([]);setReview(null);
  apiRequest('/api/enrollment',{signal:controller.signal}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});
  if(principal){setSchedules(null);setScheduleError('');apiRequest('/api/enrollment/schedules',{signal:controller.signal}).then(setSchedules).catch(e=>{if(e.name!=='AbortError')setScheduleError(e.message);});}
  return()=>controller.abort();
 },[revision,principal]);
 const sourceSection=data?.sections.find(section=>section.scope_id===source);
 const action=transitionForGrade(sourceSection?.grade_level);
 const cohortPage=useSupportPage((data?.students||[]).filter(s=>s.sectionId===source&&s.enrollmentStatus==='active'),source);
 const historyPage=useSupportPage((data?.history||[]).filter(h=>!historySection||h.from_section===historySection||h.to_section===historySection),revision+'|'+historySection);
 const reviewPage=useSupportPage((data?.students||[]).filter(s=>review?.students.some(r=>r.id===s._id)),review?.requestId);
 const schedulePage=useSupportPage(schedules||[],revision+'|schedules');
 const nextYear=nextAcademicYear(year);
 const eligible=(data?.students||[]).filter(s=>s.sectionId===source&&s.enrollmentStatus==='active');
 const issue=student=>enrollmentIssue(student,{year,grade:sourceGrade(action),blockedIds:data?.blockedStudentIds||[]});
 const ready=eligible.filter(student=>!issue(student));
 const destinations=(data?.destinations||[]).filter(section=>section.scope_id!==source);
 const dateIssue=scheduled?scheduleDateIssue(runOn):'';
 const today=manilaToday();
 const setupComplete=!!action&&validAcademicYear(year)&&(action==='graduate'||!!nextYear&&destinations.some(section=>section.scope_id===target))&&!dateIssue;
 const canReview=setupComplete&&selected.length>0&&selected.length<=500&&selected.every(id=>ready.some(student=>student._id===id));
 function chooseSource(value){setSource(value);setTarget('');reset();const years=[...new Set((data?.students||[]).filter(s=>s.sectionId===value&&s.enrollmentStatus==='active').map(s=>s.academicYear).filter(Boolean))];setYear(years.length===1?years[0]:'');}
 function reset(){setSelected([]);setReview(null);setMessage('');setError('');}
 async function apply(){if(busy||!review)return;setBusy(true);setError('');try{
  if(review.scheduled){await apiRequest('/api/enrollment/schedules',{method:'POST',body:JSON.stringify(scheduleRequest(review))});setMessage(`${transitionLabel(review.action)} scheduled for ${formatScheduleDate(review.runOn)} (${SCHEDULE_TIMEZONE}) for ${review.students.length} learner(s). Nothing changes until that date.`);setScheduled(false);setRunOn('');}
  else{const response=await apiRequest('/api/enrollment',{method:'POST',body:JSON.stringify(review)});setMessage(`${response.count} learner(s) ${review.action==='promote'?'promoted':'archived as graduated'}. Accounts and learning progress preserved.`);}
  setRevision(v=>v+1);workspace.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function cancelSchedule(){if(busy||!cancelling)return;setBusy(true);setScheduleError('');try{await apiRequest(`/api/enrollment/schedules/${encodeURIComponent(cancelling.id)}/cancel`,{method:'POST'});setMessage(`Schedule for ${cancelling.sourceName} cancelled. No enrollment changed.`);setCancelling(null);setRevision(v=>v+1);}catch(e){setScheduleError(e.message);}finally{setBusy(false);}}
 const sourceOptions=(data?.sections||[]).filter(section=>transitionForGrade(section.grade_level));
 const setupHint=!source?'Choose a current section to begin.':!validAcademicYear(year)?'Enter the current academic year.':action==='promote'&&!nextYear?'Enter a supported academic year.':action==='promote'&&!destinations.length?'A Grade 12 destination section is required.':action==='promote'&&!target?'Choose a Grade 12 destination.':dateIssue?dateIssue:!selected.length?'Select students to continue.':selected.length+' students selected. Review before confirming.';
 const effect=action==='promote'?`promoted to ${destinations.find(s=>s.scope_id===target)?.name||'the Grade 12 section'} for ${nextYear||'the next school year'}`:`graduated for ${year||'the current school year'}`;
 useEffect(()=>{if(bulkRef.current)bulkRef.current.indeterminate=selected.length>0&&selected.length<Math.min(ready.length,500);},[selected.length,ready.length,view]);
 function openReview(){if(!canReview)return;setError('');setReview({requestId:crypto.randomUUID(),sourceId:source,targetId:action==='promote'?target:null,action,fromYear:year,toYear:action==='promote'?nextYear:null,scheduled,runOn:scheduled?runOn:null,students:eligible.filter(s=>selected.includes(s._id)).map(s=>({id:s._id,version:s.enrollmentVersion}))});}
 const summary=review&&reviewSummary(review,{sourceName:data?.sections.find(s=>s.scope_id===review.sourceId)?.name,targetName:destinations.find(s=>s.scope_id===review.targetId)?.name});
 const views=[{value:'cohort',label:'Update enrollment'},{value:'history',label:'History'},...(principal?[{value:'schedules',label:'Schedules'}]:[])];
 return <div className="dashboard support-workspace cohort-workspace">
  <header className="support-page-heading"><div><h1>Section checklist</h1><p>Move students to their next year, with their progress intact.</p></div><RefreshButton loading={!data&&!error} disabled={busy||!!review} onClick={()=>setRevision(v=>v+1)}/></header>
  <div className="cohort-navigation"><SegmentedControl label="Enrollment views" value={view} disabled={busy||!!review} onChange={setView} options={views}/></div>
  {error&&!review&&<div className="cohort-notice is-error" role="alert"><p>{error}</p><WorkspaceButton disabled={busy} onClick={()=>setRevision(v=>v+1)}>Reload checklist</WorkspaceButton></div>}
  {message&&<div className="cohort-notice is-success" role="status"><Check size={18} aria-hidden="true"/><p>{message}</p></div>}
  {!data&&!error?<div className="cohort-empty" role="status">Loading enrollment...</div>:data&&<>
   {view==='cohort'?<div className="cohort-layout">
    <section className="cohort-card cohort-setup" aria-labelledby="cohort-setup-title">
     <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true">1</span><div><h2 id="cohort-setup-title">Set up the change</h2><p>The section’s confirmed grade decides the next step.</p></div></div>
     <fieldset disabled={busy||!!review} className="cohort-fields">
      <label>Current section<select value={source} disabled={!sourceOptions.length} onChange={e=>chooseSource(e.target.value)}><option value="">{sourceOptions.length?'Choose a section':'No sections available'}</option>{sourceOptions.map(s=><option value={s.scope_id} key={s.scope_id}>{s.name} · {s.grade_level}</option>)}</select></label>
      {!sourceOptions.length&&<p className="cohort-inline-notice">No assigned sections with a confirmed Grade 11 or Grade 12 are available. Check your section assignments.</p>}
      {action&&<div className="cohort-transition" role="status"><span className="workspace-control-label">Transition</span><strong>{transitionLabel(action)}</strong><p className="cohort-field-hint">{action==='promote'?'Grade 11 students move to a Grade 12 section in the next school year.':'Grade 12 students complete senior high school and leave active class lists.'}</p></div>}
      <label>Current school year<input value={year} maxLength={9} placeholder="e.g. 2026-2027" aria-invalid={!!year&&!validAcademicYear(year)} aria-describedby="cohort-year-hint" onChange={e=>{setYear(e.target.value);setSelected([]);setReview(null);setError('');}}/></label>
      <p id="cohort-year-hint" className={year&&!validAcademicYear(year)?'cohort-inline-notice':'cohort-field-hint'}>{year&&!validAcademicYear(year)?'Use consecutive years, e.g. 2026-2027.':action==='promote'&&nextYear?'Next school year: '+nextYear:action==='graduate'&&validAcademicYear(year)?'Completion year: '+year:'Use the school year students are currently enrolled in.'}</p>
      {action==='promote'&&<><label>New Grade 12 section<select value={target} disabled={!destinations.length} onChange={e=>{setTarget(e.target.value);reset();}}><option value="">{destinations.length?'Choose a destination':'No Grade 12 sections'}</option>{destinations.map(s=><option value={s.scope_id} key={s.scope_id}>{s.name}</option>)}</select></label>{!destinations.length&&<div className="cohort-inline-notice" role="alert"><strong>A destination is needed</strong><p>Promotion is unavailable until the Principal adds a Grade 12 section.</p></div>}</>}
      {principal&&action&&<div className="cohort-schedule">
       <label className="cohort-switch"><input type="checkbox" role="switch" checked={scheduled} onChange={e=>{setScheduled(e.target.checked);setRunOn('');setReview(null);}}/><span>Schedule automatically</span></label>
       {scheduled?<><label>{scheduleDateLabel(action)}<input type="date" required value={runOn} min={addDays(today,1)} max={addDays(today,SCHEDULE_MAX_DAYS)} aria-invalid={!!runOn&&!!dateIssue} aria-describedby="cohort-date-hint" onChange={e=>setRunOn(e.target.value)}/></label>
        <p id="cohort-date-hint" className={runOn&&dateIssue?'cohort-inline-notice':'cohort-field-hint'}>{runOn&&dateIssue?dateIssue:`On this date (${SCHEDULE_TIMEZONE}), the students you select will be ${effect}. Students added to this section later are not included, and anyone whose enrollment changes before then is skipped.`}</p></>
       :<p className="cohort-field-hint">Off: changes apply when you confirm the review.</p>}
      </div>}
     </fieldset>
     <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>{action==='graduate'?'Graduates leave active class lists. Their records and mobile access are kept.':'Student accounts and learning progress are kept. Teaching assignments stay the same.'}</p></div>
    </section>
    <section className="cohort-card cohort-students" aria-labelledby="cohort-students-title">
     <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true">2</span><div><h2 id="cohort-students-title">{sourceSection?sourceSection.name+' students':'Select students'}</h2><p>{sourceSection?`${sourceSection.grade_level} / ${eligible.length} active students`:'Your current section will appear here.'}</p></div>{source&&eligible.length>0&&<span className="cohort-count">{ready.length} ready</span>}</div>
     {!source?<div className="cohort-empty"><Users size={30} strokeWidth={1.5} aria-hidden="true"/><h3>Start with a section</h3><p>Choose a current section in the setup panel to see its students.</p></div>:!eligible.length?<div className="cohort-empty"><Users size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No active students</h3><p>There are no students to move from this section.</p></div>:<>
      <fieldset className="cohort-student-controls" disabled={busy||!!review}>
       <div className="cohort-selection-bar"><label className="cohort-check"><input ref={bulkRef} type="checkbox" disabled={!setupComplete||!ready.length} checked={ready.length>0&&selected.length===Math.min(ready.length,500)} onChange={e=>setSelected(e.target.checked?ready.slice(0,500).map(s=>s._id):[])}/>{ready.length>500?'Select first 500 ready students':'Select all ready students'}</label><span aria-live="polite">{setupComplete?selected.length+' selected':'Complete setup first'}</span></div>
       {eligible.length>ready.length&&<p className="cohort-attention">{eligible.length-ready.length} student(s) need attention. Check the status beside their name.</p>}
       <div className="support-table-scroll" tabIndex={0} aria-label="Student enrollment checklist"><table className="support-table cohort-table"><thead><tr><th scope="col">Student</th><th scope="col">School year</th><th scope="col">Status</th></tr></thead><tbody>{cohortPage.items.map(s=>{const reason=issue(s);return <tr key={s._id} className={selected.includes(s._id)?'is-selected':undefined}><th scope="row"><label className="cohort-check"><input type="checkbox" disabled={!setupComplete||!!reason||(!selected.includes(s._id)&&selected.length>=500)} checked={selected.includes(s._id)} onChange={e=>setSelected(v=>e.target.checked?[...v,s._id]:v.filter(id=>id!==s._id))}/>{s.name}</label></th><td>{s.academicYear||'Not recorded'}</td><td><span className={reason?'cohort-readiness needs-review':'cohort-readiness'}>{reason||'Ready'}</span></td></tr>;})}</tbody></table></div>
       <SupportPagination state={cohortPage}/>
      </fieldset>
      <p className="cohort-list-note">Selection includes all pages. Unselected students stay in this section.</p>
     </>}
     <footer className="cohort-action-footer"><div><strong>{selected.length?selected.length+' students selected':'Review before making changes'}</strong><p>{setupComplete&&selected.length?'You can check the details before confirming.':setupHint}</p></div><WorkspaceButton variant="primary" disabled={busy||!canReview} onClick={openReview}>Review selection<ArrowRight size={16} aria-hidden="true"/></WorkspaceButton></footer>
    </section>
   </div>:view==='schedules'&&principal?<section className="cohort-card cohort-history" aria-labelledby="cohort-schedules-title">
    <div className="cohort-card-heading"><CalendarClock size={20} aria-hidden="true"/><div><h2 id="cohort-schedules-title">Scheduled changes</h2><p>Run automatically on their date ({SCHEDULE_TIMEZONE}). Pending schedules can be cancelled.</p></div></div>
    {scheduleError&&<div className="cohort-notice is-error" role="alert"><p>{scheduleError}</p><WorkspaceButton disabled={busy} onClick={()=>setRevision(v=>v+1)}>Reload schedules</WorkspaceButton></div>}
    {!schedules&&!scheduleError?<div className="cohort-empty" role="status">Loading schedules...</div>:schedules&&(!schedulePage.total?<div className="cohort-empty"><CalendarClock size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No schedules</h3><p>Turn on “Schedule automatically” when setting up a change.</p></div>:<div className="support-table-scroll" tabIndex={0} aria-label="Scheduled enrollment changes"><table className="support-table cohort-table"><thead><tr><th scope="col">Date</th><th scope="col">Change</th><th scope="col">Sections</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>{schedulePage.items.map(s=><tr key={s.id}><th scope="row">{formatScheduleDate(s.runOn)}<small>{s.studentCount} learner(s)</small></th><td>{transitionLabel(s.action)}<small>{s.fromYear}{s.toYear&&' to '+s.toYear}</small></td><td>{s.sourceName}<small>{s.targetName?'To '+s.targetName:'Graduated'}</small></td><td><span className={s.status==='failed'?'cohort-readiness needs-review':'cohort-readiness'}>{SCHEDULE_STATUS[s.status]||s.status}</span><small>{s.status==='completed'?`${s.processed??0} moved${s.skipped?`, ${s.skipped} skipped`:''}`:s.error||''}</small></td><td>{s.status==='pending'&&<WorkspaceButton disabled={busy} onClick={()=>setCancelling(s)}>Cancel</WorkspaceButton>}</td></tr>)}</tbody></table></div>)}
    <SupportPagination state={schedulePage}/><p className="cohort-list-note">Skipped learners had their enrollment changed after scheduling. Review them in the Update enrollment view.</p>
   </section>:<section className="cohort-card cohort-history" aria-labelledby="cohort-history-title">
    <div className="cohort-card-heading"><History size={20} aria-hidden="true"/><div><h2 id="cohort-history-title">Enrollment history</h2><p>Recorded promotions and graduations for your sections.</p></div><label>Section<select value={historySection} onChange={e=>setHistorySection(e.target.value)}><option value="">All authorized sections</option>{data.sections.map(s=><option key={s.scope_id} value={s.scope_id}>{s.name}</option>)}</select></label></div>
    {!historyPage.total?<div className="cohort-empty"><History size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No changes recorded</h3><p>{historySection?'No enrollment changes match this section.':'Completed promotions and graduations will appear here.'}</p></div>:<div className="support-table-scroll" tabIndex={0} aria-label="Enrollment history"><table className="support-table cohort-table"><thead><tr><th scope="col">Student</th><th scope="col">Change</th><th scope="col">Sections</th><th scope="col">School years</th><th scope="col">Recorded</th></tr></thead><tbody>{historyPage.items.map(h=><tr key={h.id}><th scope="row">{h.studentName||'Learner'}</th><td><span className="cohort-readiness">{h.action==='promote'?'Promoted':'Graduated'}</span></td><td>{h.sourceName}<small>{h.targetName?'To '+h.targetName:'Archived'}</small></td><td>{h.from_year}<small>{h.to_year&&'To '+h.to_year}</small></td><td>{new Date(h.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
    <SupportPagination state={historyPage}/><p className="cohort-list-note">Outgoing students remain in this history. Access to their new section stays restricted to assigned staff.</p>
   </section>}
  </>}
  {review&&summary&&<SupportDialog title={summary.title} busy={busy} onClose={()=>{setReview(null);setError('');}}>
   <div className="cohort-review"><p><strong>{review.students.length} students</strong> · {summary.transition}</p>
    <dl className="cohort-review-route"><div><dt>Current enrollment</dt><dd>{summary.from}</dd></div><div><dt>{review.action==='promote'?'New enrollment':'After graduation'}</dt><dd>{summary.to}</dd></div><div><dt>When</dt><dd>{summary.when}</dd></div></dl>
    <h3>Selected students</h3><ul className="cohort-review-list">{reviewPage.items.map(s=><li key={s._id}>{s.name}</li>)}</ul><SupportPagination state={reviewPage}/>
    <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>{review.scheduled?'Nothing changes until the scheduled date. On that date, only these students are processed; anyone whose enrollment changed is skipped. You can cancel the schedule before then.':review.action==='promote'?'These students will leave the active Grade 11 roster.':'Mobile access stays available.'} Accounts, learning progress, and past records are preserved.</p></div>
    {error&&<div role="alert" className="cohort-notice is-error"><p>{error}</p><WorkspaceButton disabled={busy} onClick={()=>setRevision(v=>v+1)}>Reload checklist</WorkspaceButton></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={()=>{setReview(null);setError('');}}>Back to selection</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={apply}>{busy?'Applying...':summary.confirm}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
  {cancelling&&<SupportDialog title="Cancel schedule" busy={busy} onClose={()=>{setCancelling(null);setScheduleError('');}}>
   <div className="cohort-review"><p>Cancel “{transitionLabel(cancelling.action)}” for <strong>{cancelling.sourceName}</strong> on {formatScheduleDate(cancelling.runOn)}? No enrollment will change.</p>
    {scheduleError&&<div role="alert" className="cohort-notice is-error"><p>{scheduleError}</p></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={()=>{setCancelling(null);setScheduleError('');}}>Keep schedule</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={cancelSchedule}>{busy?'Cancelling...':'Cancel schedule'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
 </div>;
}
