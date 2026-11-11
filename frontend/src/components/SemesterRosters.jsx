import WorkspaceSelect from './WorkspaceSelect';
import {useWorkspaceQuery} from '../hooks/useWorkspaceQuery';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,Check,Info,Plus,Users,ArrowRight} from 'lucide-react';
import {WorkspaceButton,SegmentedControl} from './WorkspaceUI';
import {SupportDialog,SupportPagination,useSupportPage} from './SupportUI';
import {apiRequest} from '../utils/api';
import {validAcademicYear,periodLabel,periodEnlistmentIssue,pastMemberIssue,PAST_MEMBER_STATUS,rosterCounts} from '../utils/enrollment';

// Period rosters are history: enlisting adds a record for the chosen semester and never changes the student.
export default function SemesterRosters({sections,principal}){
 const bulkRef=useRef(null);
 const [periodId,setPeriodId]=useState(''),[sectionId,setSectionId]=useState(''),[view,setView]=useState('roster');
 const [detail,setDetail]=useState(null),[detailError,setDetailError]=useState(''),[revision,setRevision]=useState(0);
 const [selected,setSelected]=useState([]),[dialog,setDialog]=useState(null),[reason,setReason]=useState(''),[note,setNote]=useState(''),[draft,setDraft]=useState({academicYear:'',semester:1});
 const [busy,setBusy]=useState(false),[actionError,setActionError]=useState(''),[message,setMessage]=useState('');
 const {data:{periods:periodData},errors:{periods:periodError},refresh}=useWorkspaceQuery({periods:'/api/enrollment/periods'},{paused:!!dialog||busy});
 const periods=periodData?.periods||[];
 const period=periods.find(p=>p.id===periodId)||null;
 useEffect(()=>{if(!periodId&&periods.length)setPeriodId(periods[0].id);},[periodId,periods]);
 useEffect(()=>{
  setDetail(null);setDetailError('');setSelected([]);
  if(!periodId||!sectionId)return;
  const controller=new AbortController();
  apiRequest(`/api/enrollment/periods/${encodeURIComponent(periodId)}/sections/${encodeURIComponent(sectionId)}`,{signal:controller.signal})
   .then(result=>{if(!controller.signal.aborted)setDetail(result);})
   .catch(e=>{if(e.name!=='AbortError')setDetailError(e.message);});
  return()=>controller.abort();
 },[periodId,sectionId,revision]);

 const current=detail&&detail.period.id===periodId&&detail.section.scope_id===sectionId?detail:null;
 const grade=current?.section.grade_level||'';
 const issue=candidate=>periodEnlistmentIssue(candidate,{period,grade});
 const candidates=current?.candidates||[];
 const eligible=candidates.filter(c=>!issue(c));
 const pastMembers=current?.pastMembers||[];
 const pastEligible=pastMembers.filter(m=>!pastMemberIssue(m));
 const selectable=view==='record'?pastEligible:eligible;
 const counts=rosterCounts(current?.roster);
 const rosterPage=useSupportPage(current?.roster||[],`${periodId}|${sectionId}|${revision}|roster`);
 const candidatePage=useSupportPage(candidates,`${periodId}|${sectionId}|${revision}|candidates`);
 const pastPage=useSupportPage(pastMembers,`${periodId}|${sectionId}|${revision}|past`);
 const reviewSource=dialog?.type==='record'?pastMembers:candidates;
 const reviewPage=useSupportPage(['enlist','record'].includes(dialog?.type)?reviewSource.filter(c=>dialog.request.students.some(s=>(s.id||s)===c.id)):[],dialog?.request?.requestId);
 useEffect(()=>{if(bulkRef.current)bulkRef.current.indeterminate=selected.length>0&&selected.length<Math.min(selectable.length,500);},[selected.length,selectable.length,view]);

 function choose(setter,value){setter(value);setMessage('');setActionError('');setView('roster');}
 function close(){setDialog(null);setActionError('');setReason('');}
 async function act(work){if(busy)return;setBusy(true);setActionError('');try{await work();setDialog(null);setReason('');setNote('');setSelected([]);setRevision(v=>v+1);}catch(e){setActionError(e.message);}finally{setBusy(false);}}
 function openEnlist(){if(!selected.length||selected.length>500)return;setActionError('');setDialog({type:'enlist',request:{requestId:crypto.randomUUID(),sectionId,students:eligible.filter(c=>selected.includes(c.id)).map(c=>({id:c.id,version:c.version}))}});}
 function openRecord(){if(!selected.length||selected.length>500||note.trim().length<3)return;setActionError('');setDialog({type:'record',request:{requestId:crypto.randomUUID(),sectionId,note:note.trim(),students:pastEligible.filter(m=>selected.includes(m.id)).map(m=>m.id)}});}
 const confirmEnlist=()=>act(async()=>{
  const result=await apiRequest(`/api/enrollment/periods/${encodeURIComponent(periodId)}/enlist`,{method:'POST',body:JSON.stringify(dialog.request)});
  setView('roster');setMessage(`${result.count} student(s) enlisted for ${periodLabel(period)}.${result.unchanged?` ${result.unchanged} were already enlisted.`:''} Accounts, grades and learning progress are unchanged.`);
 });
 const confirmRecord=()=>act(async()=>{
  const result=await apiRequest(`/api/enrollment/periods/${encodeURIComponent(periodId)}/record`,{method:'POST',body:JSON.stringify(dialog.request)});
  setView('roster');setMessage(`${result.count} past membership(s) recorded for ${periodLabel(period)} and marked as recorded later.${result.unchanged?` ${result.unchanged} were already enlisted.`:''} Current enlistment and progress are unchanged.`);
 });
 const confirmWithdraw=()=>act(async()=>{
  await apiRequest(`/api/enrollment/enlistments/${encodeURIComponent(dialog.entry.id)}/withdraw`,{method:'POST',body:JSON.stringify({reason:reason.trim()})});
  setMessage(`${dialog.entry.name} was withdrawn from ${periodLabel(period)}. The record stays in this roster's history.`);
 });
 const confirmPeriod=()=>act(async()=>{
  const created=await apiRequest('/api/enrollment/periods',{method:'POST',body:JSON.stringify(draft)});
  await refresh();setPeriodId(created.id);setMessage(`${periodLabel(created)} added. No student is enlisted until staff select them.`);
 });

 if(!periodData)return <section className="cohort-card cohort-history">{periodError?<div className="cohort-notice is-error" role="alert"><p>{periodError}</p><WorkspaceButton onClick={refresh}>Try again</WorkspaceButton></div>:<div className="cohort-empty" role="status">Loading enlistment periods...</div>}</section>;
 const draftValid=validAcademicYear(draft.academicYear)&&[1,2].includes(draft.semester);
 return <div className="cohort-layout">
  <section className="cohort-card cohort-setup" aria-labelledby="semester-setup-title">
   <div className="cohort-card-heading"><CalendarDays size={20} aria-hidden="true"/><div><h2 id="semester-setup-title">Period and section</h2><p>Each semester keeps its own roster.</p></div></div>
   <fieldset disabled={busy||!!dialog} className="cohort-fields">
    <label>Academic period<WorkspaceSelect value={periodId} disabled={!periods.length} onChange={e=>choose(setPeriodId,e.target.value)}><option value="">{periods.length?'Choose a period':'No periods yet'}</option>{periods.map(p=><option key={p.id} value={p.id}>{periodLabel(p)}</option>)}</WorkspaceSelect></label>
    {!periods.length&&<p className="cohort-inline-notice">{principal?'Add the first academic period to start recording semester rosters.':'The Principal has not added an academic period yet.'}</p>}
    {principal&&<WorkspaceButton onClick={()=>{setActionError('');setDraft({academicYear:period?.academicYear||'',semester:1});setDialog({type:'period'});}}><Plus size={16} aria-hidden="true"/>Add period</WorkspaceButton>}
    <label>Section<WorkspaceSelect value={sectionId} disabled={!sections.length} onChange={e=>choose(setSectionId,e.target.value)}><option value="">{sections.length?'Choose a section':'No sections available'}</option>{sections.map(s=><option key={s.scope_id} value={s.scope_id}>{s.name}{s.grade_level?' · '+s.grade_level:''}</option>)}</WorkspaceSelect></label>
   </fieldset>
   <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>Enlisting records semester membership only. It never promotes students or changes their grade, section, account or progress.</p></div>
  </section>

  <section className="cohort-card cohort-students" aria-labelledby="semester-roster-title">
   <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true"><Users size={16}/></span><div><h2 id="semester-roster-title">{current?`${current.section.name} · ${periodLabel(current.period)}`:'Semester roster'}</h2><p>{current?`${counts.active} enlisted${counts.withdrawn?` · ${counts.withdrawn} withdrawn`:''}`:'Choose a period and a section.'}</p></div>{current&&<SegmentedControl label="Roster views" value={view} disabled={busy||!!dialog} onChange={v=>{setView(v);setSelected([]);setMessage('');}} options={[{value:'roster',label:'Roster'},{value:'enlist',label:'Enlist students'},{value:'record',label:'Record past membership'}]}/>}</div>
   {message&&<div className="cohort-notice is-success advancement-inline" role="status"><Check size={18} aria-hidden="true"/><p>{message}</p></div>}
   {actionError&&!dialog&&<div className="cohort-notice is-error advancement-inline" role="alert"><p>{actionError}</p></div>}
   {detailError?<div className="cohort-notice is-error advancement-inline" role="alert"><p>{detailError}</p><WorkspaceButton onClick={()=>setRevision(v=>v+1)}>Try again</WorkspaceButton></div>
   :!periodId||!sectionId?<div className="cohort-empty"><Users size={30} strokeWidth={1.5} aria-hidden="true"/><h3>Start with a period and section</h3><p>Past periods keep the students who were enlisted at the time.</p></div>
   :!current?<div className="cohort-empty" role="status">Loading roster...</div>
   :view==='roster'?<>
    {!current.roster.length?<div className="cohort-empty"><Users size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No students enlisted</h3><p>Nobody is recorded in this section for {periodLabel(current.period)}. Use Enlist students to add them.</p></div>
    :<div className="support-table-scroll" tabIndex={0} aria-label="Semester roster"><table className="support-table cohort-table"><thead><tr><th scope="col">Student</th><th scope="col">Grade then</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
     {rosterPage.items.map(e=><tr key={e.id}><th scope="row">{e.name}<small>{e.recordedLater?`Recorded later on ${new Date(e.enlistedAt).toLocaleDateString()} · ${e.note}`:`Enlisted ${new Date(e.enlistedAt).toLocaleDateString()}`}</small>{e.recordedLater&&<span className="cohort-readiness needs-review">Recorded later</span>}</th><td>{e.gradeLevel}</td>
      <td>{e.withdrawnAt?<><span className="cohort-readiness needs-review">Withdrawn</span><small>{e.withdrawalReason}</small></>:<span className="cohort-readiness">Enlisted</span>}</td>
      <td>{!e.withdrawnAt&&<WorkspaceButton disabled={busy} onClick={()=>{setActionError('');setReason('');setDialog({type:'withdraw',entry:e});}}>Withdraw</WorkspaceButton>}</td></tr>)}
    </tbody></table></div>}
    <SupportPagination state={rosterPage}/>
    <p className="cohort-list-note">Students who later moved or graduated stay on this roster. Withdrawn records are kept with their reason.</p>
   </>:view==='record'?<>
    {!pastMembers.length?<div className="cohort-empty"><Users size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No recorded members</h3><p>Only students currently in this section, or with a recorded move into or out of it, can be added.</p></div>:<fieldset className="cohort-student-controls" disabled={busy||!!dialog}>
     <div className="cohort-selection-bar"><label className="cohort-check"><input ref={bulkRef} type="checkbox" disabled={!pastEligible.length} checked={pastEligible.length>0&&selected.length===Math.min(pastEligible.length,500)} onChange={e=>setSelected(e.target.checked?pastEligible.slice(0,500).map(m=>m.id):[])}/>Select all not yet enlisted</label><span aria-live="polite">{selected.length} selected</span></div>
     <div className="support-table-scroll" tabIndex={0} aria-label="Past members to record"><table className="support-table cohort-table"><thead><tr><th scope="col">Student</th><th scope="col">Now</th><th scope="col">This period</th></tr></thead><tbody>
      {pastPage.items.map(m=>{const reason=pastMemberIssue(m);return <tr key={m.id} className={selected.includes(m.id)?'is-selected':undefined}><th scope="row"><label className="cohort-check"><input type="checkbox" disabled={!!reason||(!selected.includes(m.id)&&selected.length>=500)} checked={selected.includes(m.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,m.id]:v.filter(id=>id!==m.id))}/>{m.name}</label></th><td>{PAST_MEMBER_STATUS[m.status]}</td><td><span className={reason&&reason!=='Already enlisted'?'cohort-readiness needs-review':'cohort-readiness'}>{reason||'Not recorded'}</span></td></tr>;})}
     </tbody></table></div>
     <SupportPagination state={pastPage}/>
     <div className="cohort-fields"><label>Basis for this record<input value={note} maxLength={300} placeholder="e.g. Semester 1 class list signed by the adviser" onChange={e=>setNote(e.target.value)}/></label><p className="cohort-field-hint">Required. Shown with each record so staff can tell it was added afterwards.</p></div>
    </fieldset>}
    <footer className="cohort-action-footer"><div><strong>{selected.length?selected.length+' students selected':'Select students to record'}</strong><p>Records are marked "Recorded later". Current sections, grades and progress do not change.</p></div><WorkspaceButton variant="primary" disabled={busy||!selected.length||note.trim().length<3} onClick={openRecord}>Review record<ArrowRight size={16} aria-hidden="true"/></WorkspaceButton></footer>
   </>:<>
    {!candidates.length?<div className="cohort-empty"><Users size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No active students</h3><p>Only students currently in this section can be enlisted.</p></div>:<fieldset className="cohort-student-controls" disabled={busy||!!dialog}>
     <div className="cohort-selection-bar"><label className="cohort-check"><input ref={bulkRef} type="checkbox" disabled={!eligible.length} checked={eligible.length>0&&selected.length===Math.min(eligible.length,500)} onChange={e=>setSelected(e.target.checked?eligible.slice(0,500).map(c=>c.id):[])}/>{eligible.length>500?'Select first 500 students':'Select all students not yet enlisted'}</label><span aria-live="polite">{selected.length} selected</span></div>
     <div className="support-table-scroll" tabIndex={0} aria-label="Students to enlist"><table className="support-table cohort-table"><thead><tr><th scope="col">Student</th><th scope="col">School year</th><th scope="col">Status</th></tr></thead><tbody>
      {candidatePage.items.map(c=>{const reason=issue(c);return <tr key={c.id} className={selected.includes(c.id)?'is-selected':undefined}><th scope="row"><label className="cohort-check"><input type="checkbox" disabled={!!reason||(!selected.includes(c.id)&&selected.length>=500)} checked={selected.includes(c.id)} onChange={e=>setSelected(v=>e.target.checked?[...v,c.id]:v.filter(id=>id!==c.id))}/>{c.name}</label></th><td>{c.academicYear||'Not recorded'}</td><td><span className={reason&&reason!=='Already enlisted'?'cohort-readiness needs-review':'cohort-readiness'}>{reason||'Not yet enlisted'}</span></td></tr>;})}
     </tbody></table></div>
     <SupportPagination state={candidatePage}/>
    </fieldset>}
    <footer className="cohort-action-footer"><div><strong>{selected.length?selected.length+' students selected':'Select students to enlist'}</strong><p>Unselected students stay in their section and are not enlisted for this period.</p></div><WorkspaceButton variant="primary" disabled={busy||!selected.length} onClick={openEnlist}>Review enlistment<ArrowRight size={16} aria-hidden="true"/></WorkspaceButton></footer>
   </>}
  </section>

  {dialog?.type==='enlist'&&<SupportDialog title="Review enlistment" busy={busy} onClose={close}>
   <div className="cohort-review"><p><strong>{dialog.request.students.length} students</strong> · {current?.section.name} · {periodLabel(period)}</p>
    <h3>Selected students</h3><ul className="cohort-review-list">{reviewPage.items.map(c=><li key={c.id}>{c.name}</li>)}</ul><SupportPagination state={reviewPage}/>
    <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>Only this period's roster changes. Grades, sections, accounts, learning progress and earlier rosters are preserved.</p></div>
    {actionError&&<div role="alert" className="cohort-notice is-error"><p>{actionError}</p><WorkspaceButton disabled={busy} onClick={()=>{close();setRevision(v=>v+1);}}>Reload roster</WorkspaceButton></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={close}>Back to selection</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={confirmEnlist}>{busy?'Enlisting...':'Confirm enlistment'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
  {dialog?.type==='record'&&<SupportDialog title="Record past membership" busy={busy} onClose={close}>
   <div className="cohort-review"><p><strong>{dialog.request.students.length} students</strong> · {current?.section.name} · {periodLabel(period)}</p>
    <dl className="cohort-review-route"><div><dt>Basis</dt><dd>{dialog.request.note}</dd></div><div><dt>Marked as</dt><dd>Recorded later</dd></div></dl>
    <h3>Selected students</h3><ul className="cohort-review-list">{reviewPage.items.map(m=><li key={m.id}>{m.name}</li>)}</ul><SupportPagination state={reviewPage}/>
    <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>Only this period's roster changes. Current sections, grades, accounts and learning progress are preserved.</p></div>
    {actionError&&<div role="alert" className="cohort-notice is-error"><p>{actionError}</p><WorkspaceButton disabled={busy} onClick={()=>{close();setRevision(v=>v+1);}}>Reload roster</WorkspaceButton></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={close}>Back to selection</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={confirmRecord}>{busy?'Recording...':'Confirm record'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
  {dialog?.type==='withdraw'&&<SupportDialog title="Withdraw enlistment?" busy={busy} onClose={close}>
   <div className="cohort-review"><p>Withdraw <strong>{dialog.entry.name}</strong> from {current?.section.name} for {periodLabel(period)}? The record is kept and marked as withdrawn.</p>
    <label className="cohort-fields">Reason<input value={reason} maxLength={300} placeholder="e.g. Enlisted in the wrong section" onChange={e=>setReason(e.target.value)}/></label>
    {actionError&&<div role="alert" className="cohort-notice is-error"><p>{actionError}</p></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={close}>Keep enlistment</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy||reason.trim().length<3} onClick={confirmWithdraw}>{busy?'Withdrawing...':'Withdraw'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
  {dialog?.type==='period'&&<SupportDialog title="Add academic period" busy={busy} onClose={close}>
   <div className="cohort-review">
    <fieldset className="cohort-fields" disabled={busy}>
     <label>Academic year<input value={draft.academicYear} maxLength={9} placeholder="e.g. 2026-2027" aria-invalid={!!draft.academicYear&&!validAcademicYear(draft.academicYear)} onChange={e=>setDraft(v=>({...v,academicYear:e.target.value}))}/></label>
     <div className="workspace-control-field"><span className="workspace-control-label">Semester</span><SegmentedControl label="Semester" value={draft.semester} onChange={semester=>setDraft(v=>({...v,semester}))} options={[{value:1,label:'Semester 1'},{value:2,label:'Semester 2'}]}/></div>
    </fieldset>
    <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>A new period starts empty. Staff then enlist the students who continue; nobody is promoted.</p></div>
    {actionError&&<div role="alert" className="cohort-notice is-error"><p>{actionError}</p></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={close}>Cancel</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy||!draftValid} onClick={confirmPeriod}>{busy?'Adding...':'Add period'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
 </div>;
}
