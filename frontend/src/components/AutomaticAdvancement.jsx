import {useEffect,useState} from 'react';
import {CalendarClock,Check,Info,History,ArrowRight} from 'lucide-react';
import {WorkspaceButton} from './WorkspaceUI';
import {SupportDialog,SupportPagination,useSupportPage} from './SupportUI';
import {apiRequest} from '../utils/api';
import {validAcademicYear,nextAcademicYear,scheduleDateIssue,manilaToday,addDays,SCHEDULE_MAX_DAYS,SCHEDULE_TIMEZONE,formatScheduleDate,transitionLabel,advancementOverview,advancementIssues,advancementRequest,skipReasonLabel,PLAN_STATUS} from '../utils/enrollment';

function SectionResults({plan}){
 return <div className="support-table-scroll" tabIndex={0} aria-label="Section results"><table className="support-table cohort-table"><thead><tr><th scope="col">Section</th><th scope="col">Change</th><th scope="col">Students</th><th scope="col">Result</th></tr></thead><tbody>
  {plan.sections.map(s=><tr key={s.id}><th scope="row">{s.sourceName}<small>{s.targetName?'To '+s.targetName:'Graduates'}</small></th><td>{transitionLabel(s.action)}</td><td>{s.studentCount}</td>
   <td>{s.status==='pending'?<span className="cohort-readiness">Waiting</span>:s.status==='cancelled'?<span className="cohort-readiness">Cancelled</span>:s.status==='failed'?<><span className="cohort-readiness needs-review">Failed</span><small>{s.error}</small></>:<><span className="cohort-readiness">{s.processed??0} moved</span>
    {s.skippedStudents.length>0&&<ul className="advancement-reasons">{s.skippedStudents.map((x,i)=><li key={i}><strong>{x.name}</strong> · {skipReasonLabel(x.reason)}</li>)}</ul>}</>}</td></tr>)}
 </tbody></table></div>;
}
function Exclusions({items,label}){
 const page=useSupportPage(items,label+items.length);
 if(!items.length)return <p className="cohort-field-hint">No students are excluded.</p>;
 return <><div className="support-table-scroll" tabIndex={0} aria-label={label}><table className="support-table cohort-table"><thead><tr><th scope="col">Student</th><th scope="col">Section</th><th scope="col">Reason</th></tr></thead><tbody>
  {page.items.map((x,i)=><tr key={(x.id||x.name)+i}><th scope="row">{x.name}</th><td>{x.sectionName}</td><td><span className="cohort-readiness needs-review">{skipReasonLabel(x.reason)}</span></td></tr>)}
 </tbody></table></div>{page.pages>1&&<SupportPagination state={page}/>}</>;
}

// The pending plan in the database is the switch's only persisted state; there is no client-side timer.
export default function AutomaticAdvancement(){
 const [status,setStatus]=useState(null),[loadError,setLoadError]=useState(''),[revision,setRevision]=useState(0);
 const [enabling,setEnabling]=useState(false),[year,setYear]=useState(''),[runOn,setRunOn]=useState(''),[destinations,setDestinations]=useState({});
 const [preview,setPreview]=useState(null),[previewError,setPreviewError]=useState(''),[previewLoading,setPreviewLoading]=useState(false);
 const [dialog,setDialog]=useState(null),[busy,setBusy]=useState(false),[actionError,setActionError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{const controller=new AbortController();setLoadError('');
  apiRequest('/api/enrollment/advancement',{signal:controller.signal}).then(setStatus).catch(e=>{if(e.name!=='AbortError')setLoadError(e.message);});
  return()=>controller.abort();
 },[revision]);
 const requestedYear=validAcademicYear(year)?year:'';
 useEffect(()=>{
  if(!enabling||(year&&!requestedYear))return;
  const controller=new AbortController();setPreviewLoading(true);setPreviewError('');
  apiRequest(`/api/enrollment/advancement/preview${requestedYear?'?fromYear='+encodeURIComponent(requestedYear):''}`,{signal:controller.signal})
   .then(result=>{setPreview(result);if(!requestedYear&&result.fromYear)setYear(result.fromYear);})
   .catch(e=>{if(e.name!=='AbortError')setPreviewError(e.message);})
   .finally(()=>{if(!controller.signal.aborted)setPreviewLoading(false);});
  return()=>controller.abort();
 },[enabling,requestedYear,revision]);

 const pending=status?.plans.find(p=>p.status==='pending');
 const past=(status?.plans||[]).filter(p=>p.status!=='pending');
 const legacy=status?.legacySchedules||[];
 const pastPage=useSupportPage(past,revision+'|past');
 const current=preview&&preview.fromYear===requestedYear?preview:null;
 const overview=advancementOverview(current);
 const issues=advancementIssues({preview:current,year,runOn,destinations,legacyCount:legacy.length});
 const today=manilaToday(),dateIssue=runOn?scheduleDateIssue(runOn):'';
 const nameOf=id=>current?.destinations.find(d=>d.id===id)?.name||'';

 function closeSetup(){setEnabling(false);setPreview(null);setYear('');setRunOn('');setDestinations({});setPreviewError('');}
 function toggle(on){setMessage('');setActionError('');if(on){setEnabling(true);return;}if(pending)setDialog({type:'cancel-plan',plan:pending});else closeSetup();}
 async function act(work){if(busy)return;setBusy(true);setActionError('');try{await work();setDialog(null);setRevision(v=>v+1);}catch(e){setActionError(e.message);}finally{setBusy(false);}}
 const confirmPlan=()=>act(async()=>{
  const plan=await apiRequest('/api/enrollment/advancement',{method:'POST',body:JSON.stringify(advancementRequest(current,{runOn,destinations}))});
  closeSetup();setMessage(`Automatic advancement scheduled for ${formatScheduleDate(plan.runOn)} (${SCHEDULE_TIMEZONE}): ${plan.promote} to promote and ${plan.graduate} to graduate. Nothing changes before then.`);
 });
 const cancelPlan=plan=>act(async()=>{await apiRequest(`/api/enrollment/advancement/${encodeURIComponent(plan.id)}/cancel`,{method:'POST'});closeSetup();setMessage('Automatic advancement is off. The pending plan was cancelled and no student was moved.');});
 const cancelLegacy=schedule=>act(async()=>{await apiRequest(`/api/enrollment/schedules/${encodeURIComponent(schedule.id)}/cancel`,{method:'POST'});setMessage(`Individual schedule for ${schedule.sourceName} cancelled. No enrollment changed.`);});

 if(!status)return <section className="cohort-card cohort-history">{loadError?<div className="cohort-notice is-error" role="alert"><p>{loadError}</p><WorkspaceButton onClick={()=>setRevision(v=>v+1)}>Try again</WorkspaceButton></div>:<div className="cohort-empty" role="status">Loading automatic advancement...</div>}</section>;
 const switchOn=!!pending||enabling;
 return <div className="advancement">
  <section className="cohort-card" aria-labelledby="advancement-title">
   <div className="cohort-card-heading"><CalendarClock size={20} aria-hidden="true"/><div><h2 id="advancement-title">Automatic Advancement</h2><p>Schedule school-wide promotion and graduation.</p></div></div>
   <div className="advancement-switch-row">
    <label className="cohort-switch"><input type="checkbox" role="switch" checked={switchOn} disabled={busy} onChange={e=>toggle(e.target.checked)}/><span>Enable automatic advancement</span></label>
    <p className="cohort-field-hint" role="status">{pending?`On · runs ${formatScheduleDate(pending.runOn)} (${SCHEDULE_TIMEZONE}) for school year ${pending.fromYear}.`:enabling?'Set up the plan below. Nothing is scheduled until you confirm.':'Off · no automatic advancement is scheduled.'}</p>
   </div>
   {message&&<div className="cohort-notice is-success advancement-inline" role="status"><Check size={18} aria-hidden="true"/><p>{message}</p></div>}
   {actionError&&!dialog&&<div className="cohort-notice is-error advancement-inline" role="alert"><p>{actionError}</p></div>}
   {legacy.length>0&&<div className="advancement-legacy">
    <div className="cohort-inline-notice" role="alert"><strong>Individual section schedules are still pending</strong><p>They were created before school-wide advancement and will still run on their date. Cancel them before confirming a school-wide plan.</p></div>
    <ul className="advancement-list">{legacy.map(s=><li key={s.id}><div><strong>{s.sourceName}</strong><small>{transitionLabel(s.action)} · {formatScheduleDate(s.runOn)} · {s.studentCount} student(s)</small></div><WorkspaceButton disabled={busy} onClick={()=>setDialog({type:'cancel-legacy',schedule:s})}>Cancel</WorkspaceButton></li>)}</ul>
   </div>}
  </section>

  {pending&&<section className="cohort-card" aria-labelledby="advancement-pending-title">
   <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true"><Check size={16}/></span><div><h2 id="advancement-pending-title">Scheduled plan</h2><p>Runs at the first scheduler check after 00:00 {SCHEDULE_TIMEZONE} on {formatScheduleDate(pending.runOn)}.</p></div></div>
   <dl className="advancement-stats"><div><dt>School year</dt><dd>{pending.fromYear}<small>Next: {pending.toYear}</small></dd></div><div><dt>Grade 11 → Grade 12</dt><dd>{pending.promote}<small>students to promote</small></dd></div><div><dt>Grade 12 graduating</dt><dd>{pending.graduate}<small>students to graduate</small></dd></div><div><dt>Excluded</dt><dd>{pending.exclusions.length}<small>at confirmation</small></dd></div></dl>
   <SectionResults plan={pending}/>
   {pending.exclusions.length>0&&<details className="advancement-details"><summary>Excluded students ({pending.exclusions.length})</summary><Exclusions items={pending.exclusions} label="Excluded students"/></details>}
   <footer className="cohort-action-footer"><div><strong>Only the students captured at confirmation are processed</strong><p>Anyone whose enrollment changes before the date is skipped with a recorded reason. Students added later are not included.</p></div><WorkspaceButton disabled={busy} onClick={()=>setDialog({type:'cancel-plan',plan:pending})}>Cancel pending schedule</WorkspaceButton></footer>
  </section>}

  {enabling&&!pending&&<>
   <section className="cohort-card" aria-labelledby="advancement-date-title">
    <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true">2</span><div><h2 id="advancement-date-title">School year and date</h2><p>The plan runs once. A later school year needs a new plan.</p></div></div>
    <fieldset className="cohort-fields advancement-fields" disabled={busy}>
     <div><label>Current school year<input value={year} maxLength={9} placeholder="e.g. 2026-2027" aria-invalid={!!year&&!requestedYear} aria-describedby="advancement-year-hint" onChange={e=>setYear(e.target.value)}/></label>
      <p id="advancement-year-hint" className={year&&!requestedYear?'cohort-inline-notice':'cohort-field-hint'}>{year&&!requestedYear?'Use consecutive years, e.g. 2026-2027.':requestedYear?`Promoted students move to ${nextAcademicYear(year)}; graduates complete ${year}.`:'Use the school year students are currently enrolled in.'}</p></div>
     <div><label>Advancement date<input type="date" required value={runOn} min={addDays(today,1)} max={addDays(today,SCHEDULE_MAX_DAYS)} aria-invalid={!!dateIssue} aria-describedby="advancement-date-hint" onChange={e=>setRunOn(e.target.value)}/></label>
      <p id="advancement-date-hint" className={dateIssue?'cohort-inline-notice':'cohort-field-hint'}>{dateIssue||`Date in ${SCHEDULE_TIMEZONE}. Nothing moves before 00:00 on this date.`}</p></div>
    </fieldset>
   </section>

   {previewError?<div className="cohort-notice is-error" role="alert"><p>{previewError}</p><WorkspaceButton onClick={()=>setRevision(v=>v+1)}>Try again</WorkspaceButton></div>
   :previewLoading||(requestedYear&&!current)?<section className="cohort-card"><div className="cohort-empty" role="status">Loading students...</div></section>
   :current&&<>
    <section className="cohort-card" aria-labelledby="advancement-destinations-title">
     <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true">3</span><div><h2 id="advancement-destinations-title">Grade 12 destinations</h2><p>Choose where each Grade 11 section moves. Nothing is chosen for you.</p></div></div>
     {!overview.promoting.length?<p className="advancement-body cohort-field-hint">No Grade 11 students to promote this school year.</p>
     :!current.destinations.length?<div className="advancement-body"><div className="cohort-inline-notice" role="alert"><strong>Create a Grade 12 section first</strong><p>Promotion needs an existing Grade 12 section. Add one under Sections, then refresh this tab.</p></div></div>
     :<fieldset className="advancement-mapping" disabled={busy}>{overview.promoting.map(s=><label key={s.id}><span><strong>{s.name}</strong><small>Grade 11 · {s.students.length} student(s)</small></span><ArrowRight size={16} aria-hidden="true"/>
      <select value={destinations[s.id]||''} aria-invalid={!current.destinations.some(d=>d.id===destinations[s.id])} onChange={e=>setDestinations(v=>({...v,[s.id]:e.target.value}))}><option value="">Choose a Grade 12 section</option>{current.destinations.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label>)}</fieldset>}
    </section>

    <section className="cohort-card" aria-labelledby="advancement-review-title">
     <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true">4</span><div><h2 id="advancement-review-title">Affected students</h2><p>Every Grade 11 and Grade 12 section in the school, as of now.</p></div></div>
     <dl className="advancement-stats"><div><dt>Grade 11 → Grade 12</dt><dd>{overview.promoteCount}<small>in {overview.promoting.length} section(s)</small></dd></div><div><dt>Grade 12 graduating</dt><dd>{overview.graduateCount}<small>in {overview.graduating.length} section(s)</small></dd></div><div><dt>Excluded</dt><dd>{overview.excluded.length}<small>shown below</small></dd></div></dl>
     <div className="support-table-scroll" tabIndex={0} aria-label="Sections in the plan"><table className="support-table cohort-table"><thead><tr><th scope="col">Section</th><th scope="col">Change</th><th scope="col">Included</th><th scope="col">Excluded</th></tr></thead><tbody>
      {current.sections.map(s=><tr key={s.id}><th scope="row">{s.name}<small>{s.grade}</small></th><td>{s.students.length?transitionLabel(s.action):'No change'}<small>{s.action==='promote'&&s.students.length?(nameOf(destinations[s.id])?'To '+nameOf(destinations[s.id]):'Destination needed'):''}</small></td><td>{s.students.length}</td><td>{s.excluded.length}</td></tr>)}
     </tbody></table></div>
     <div className="advancement-body"><h3>Excluded students</h3><p className="cohort-field-hint">These students stay where they are. Students in sections without a confirmed grade are listed here; confirm the section grade first if they should be included.</p><Exclusions items={overview.excluded} label="Students excluded from the plan"/></div>
     <footer className="cohort-action-footer"><div><strong>{issues.length?'Before confirming':`${overview.included} students will be scheduled`}</strong>{issues.length?<ul className="advancement-issues">{issues.map(issue=><li key={issue}>{issue}</li>)}</ul>:<p>Review the plan, then confirm. Students added later are not included.</p>}</div>
      <WorkspaceButton variant="primary" disabled={busy||issues.length>0} onClick={()=>{setActionError('');setDialog({type:'confirm'});}}>Review and confirm<ArrowRight size={16} aria-hidden="true"/></WorkspaceButton></footer>
    </section>
   </>}
  </>}

  <section className="cohort-card cohort-history" aria-labelledby="advancement-history-title">
   <div className="cohort-card-heading"><History size={20} aria-hidden="true"/><div><h2 id="advancement-history-title">Previous results</h2><p>Completed, failed and cancelled plans, with skipped students and their reasons.</p></div></div>
   {!past.length?<div className="cohort-empty"><History size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No previous plans</h3><p>Results appear here after a plan runs or is cancelled.</p></div>
   :<ul className="advancement-history">{pastPage.items.map(p=><li key={p.id}><details className="advancement-details"><summary><span><strong>{formatScheduleDate(p.runOn)}</strong> · {p.fromYear}</span><span className={['failed','partial'].includes(p.status)?'cohort-readiness needs-review':'cohort-readiness'}>{PLAN_STATUS[p.status]||p.status}</span>
     <small>{p.status==='cancelled'?'No student was moved.':p.result?`${p.result.processed} moved · ${p.result.skipped} skipped${p.result.failed?` · ${p.result.failed} section(s) failed`:''}`:''}</small></summary>
     <SectionResults plan={p}/>{p.exclusions.length>0&&<div className="advancement-body"><h3>Excluded at confirmation</h3><Exclusions items={p.exclusions} label="Excluded at confirmation"/></div>}</details></li>)}</ul>}
   {past.length>10&&<SupportPagination state={pastPage}/>}
  </section>

  {dialog?.type==='confirm'&&current&&<SupportDialog title="Confirm school-wide schedule" busy={busy} onClose={()=>{setDialog(null);setActionError('');}}>
   <div className="cohort-review">
    <dl className="cohort-review-route"><div><dt>When</dt><dd>{formatScheduleDate(runOn)}<small>{SCHEDULE_TIMEZONE}, once</small></dd></div><div><dt>School year</dt><dd>{current.fromYear}<small>Promoted students move to {current.toYear}</small></dd></div>
     <div><dt>Promote to Grade 12</dt><dd>{overview.promoteCount} students</dd></div><div><dt>Graduate</dt><dd>{overview.graduateCount} students</dd></div></dl>
    {overview.promoting.length>0&&<><h3>Section assignments</h3><ul className="advancement-list">{overview.promoting.map(s=><li key={s.id}><div><strong>{s.name}</strong><small>{s.students.length} student(s)</small></div><span>→ {nameOf(destinations[s.id])}</span></li>)}</ul></>}
    <p><strong>{overview.excluded.length}</strong> student(s) are excluded and stay where they are.</p>
    <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>Nothing changes until the date. Only these students are processed; anyone whose enrollment changes before then is skipped. Accounts, learning progress, mastery records and history are preserved.</p></div>
    {actionError&&<div role="alert" className="cohort-notice is-error"><p>{actionError}</p><WorkspaceButton disabled={busy} onClick={()=>{setDialog(null);setActionError('');setRevision(v=>v+1);}}>Refresh preview</WorkspaceButton></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={()=>{setDialog(null);setActionError('');}}>Back</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={confirmPlan}>{busy?'Scheduling...':'Confirm school-wide schedule'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
  {dialog?.type==='cancel-plan'&&<SupportDialog title="Turn off automatic advancement?" busy={busy} onClose={()=>{setDialog(null);setActionError('');}}>
   <div className="cohort-review"><p>This cancels the plan scheduled for <strong>{formatScheduleDate(dialog.plan.runOn)}</strong> ({dialog.plan.promote} to promote, {dialog.plan.graduate} to graduate). No student will be moved.</p>
    {actionError&&<div role="alert" className="cohort-notice is-error"><p>{actionError}</p></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={()=>{setDialog(null);setActionError('');}}>Keep schedule</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={()=>cancelPlan(dialog.plan)}>{busy?'Cancelling...':'Cancel schedule'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
  {dialog?.type==='cancel-legacy'&&<SupportDialog title="Cancel section schedule" busy={busy} onClose={()=>{setDialog(null);setActionError('');}}>
   <div className="cohort-review"><p>Cancel “{transitionLabel(dialog.schedule.action)}” for <strong>{dialog.schedule.sourceName}</strong> on {formatScheduleDate(dialog.schedule.runOn)}? No enrollment will change.</p>
    {actionError&&<div role="alert" className="cohort-notice is-error"><p>{actionError}</p></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={()=>{setDialog(null);setActionError('');}}>Keep schedule</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={()=>cancelLegacy(dialog.schedule)}>{busy?'Cancelling...':'Cancel schedule'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
 </div>;
}
