import {WorkspaceButton,RefreshButton,SegmentedControl} from '../components/WorkspaceUI';
import {SupportDialog,SupportPagination,useSupportPage} from '../components/SupportUI';
import '../styles/support.css';
import {useEffect,useRef,useState} from 'react';
import {Users,ArrowRight,Check,Info,History} from 'lucide-react';
import '../styles/cohort-checklist.css';
import {apiRequest} from '../utils/api';
import {useWorkspaceData} from '../context/WorkspaceDataContext';
import {validAcademicYear,nextAcademicYear,enrollmentIssue} from '../utils/enrollment';
export default function CohortChecklist(){
 const [view,setView]=useState('cohort');
 const bulkRef=useRef(null);
 const workspace=useWorkspaceData();
 const [historySection,setHistorySection]=useState('');
 const [data,setData]=useState(null),[source,setSource]=useState(''),[target,setTarget]=useState(''),[action,setAction]=useState('promote'),[year,setYear]=useState(''),[selected,setSelected]=useState([]),[review,setReview]=useState(null),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');setSelected([]);setReview(null);
  apiRequest('/api/enrollment',{signal:controller.signal}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message);});return()=>controller.abort();
 },[revision]);
 const cohortPage=useSupportPage((data?.students||[]).filter(s=>s.sectionId===source&&s.enrollmentStatus==='active'),source+'|'+action);
 const historyPage=useSupportPage((data?.history||[]).filter(h=>!historySection||h.from_section===historySection||h.to_section===historySection),revision+'|'+historySection);
 const reviewPage=useSupportPage((data?.students||[]).filter(s=>review?.students.some(r=>r.id===s._id)),review?.requestId);
 const nextYear=nextAcademicYear(year);
 const eligible=(data?.students||[]).filter(s=>s.sectionId===source&&s.enrollmentStatus==='active');
 const issue=student=>enrollmentIssue(student,{year,grade:action==='promote'?'Grade 11':'Grade 12',blockedIds:data?.blockedStudentIds||[]});
 const ready=eligible.filter(student=>!issue(student));
 const destinations=data?.destinations||[];
 const canReview=selected.length>0&&selected.length<=500&&validAcademicYear(year)&&selected.every(id=>ready.some(student=>student._id===id))&&(action==='graduate'||(nextYear&&destinations.some(section=>section.scope_id===target)));
 function chooseSource(value){setSource(value);setTarget('');reset();const years=[...new Set((data?.students||[]).filter(s=>s.sectionId===value&&s.enrollmentStatus==='active').map(s=>s.academicYear).filter(Boolean))];setYear(years.length===1?years[0]:'');}

 function reset(){setSelected([]);setReview(null);setMessage('');setError('');}
 async function apply(){if(busy||!review)return;setBusy(true);setError('');try{const response=await apiRequest('/api/enrollment',{method:'POST',body:JSON.stringify(review)});setMessage(`${response.count} learner(s) ${review.action==='promote'?'promoted':'archived as graduated'}. Accounts and learning progress preserved.`);setRevision(v=>v+1);workspace.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 const sourceSection=data?.sections.find(section=>section.scope_id===source);
 const sourceOptions=(data?.sections||[]).filter(section=>section.grade_level===(action==='promote'?'Grade 11':'Grade 12'));
 const setupComplete=!!source&&validAcademicYear(year)&&(action==='graduate'||!!nextYear&&destinations.some(section=>section.scope_id===target));
 const setupHint=!source?'Choose a current section to begin.':!validAcademicYear(year)?'Enter the current academic year.':action==='promote'&&!nextYear?'Enter a supported academic year.':action==='promote'&&!target?'Choose a Grade 12 destination.':!selected.length?'Select students to continue.':selected.length+' students selected. Review before confirming.';
 useEffect(()=>{if(bulkRef.current)bulkRef.current.indeterminate=selected.length>0&&selected.length<Math.min(ready.length,500);},[selected.length,ready.length,view]);
 function openReview(){if(!canReview)return;setError('');setReview({requestId:crypto.randomUUID(),sourceId:source,targetId:action==='promote'?target:null,action,fromYear:year,toYear:action==='promote'?nextYear:null,students:eligible.filter(s=>selected.includes(s._id)).map(s=>({id:s._id,version:s.enrollmentVersion}))});}
 return <div className="dashboard support-workspace cohort-workspace">
  <header className="support-page-heading"><div><h1>Section checklist</h1><p>Move students to their next year, with their progress intact.</p></div><RefreshButton loading={!data&&!error} disabled={busy||!!review} onClick={()=>setRevision(v=>v+1)}/></header>
  <div className="cohort-navigation"><SegmentedControl label="Enrollment views" value={view} disabled={busy||!!review} onChange={setView} options={[{value:'cohort',label:'Update enrollment'},{value:'history',label:'History'}]}/></div>
  {error&&!review&&<div className="cohort-notice is-error" role="alert"><p>{error}</p><WorkspaceButton disabled={busy} onClick={()=>setRevision(v=>v+1)}>Reload checklist</WorkspaceButton></div>}
  {message&&<div className="cohort-notice is-success" role="status"><Check size={18} aria-hidden="true"/><p>{message}</p></div>}
  {!data&&!error?<div className="cohort-empty" role="status">Loading enrollment...</div>:data&&<>
   {view==='cohort'?<div className="cohort-layout">
    <section className="cohort-card cohort-setup" aria-labelledby="cohort-setup-title">
     <div className="cohort-card-heading"><span className="cohort-step" aria-hidden="true">1</span><div><h2 id="cohort-setup-title">Set up the change</h2><p>Choose where students go next.</p></div></div>
     <fieldset disabled={busy||!!review} className="cohort-fields">
      <div><span className="workspace-control-label">What would you like to do?</span><SegmentedControl label="Enrollment action" value={action} options={[{value:'promote',label:'Promote'},{value:'graduate',label:'Graduate'}]} onChange={value=>{setAction(value);setSource('');setTarget('');setYear('');reset();}}/><p className="cohort-field-hint">{action==='promote'?'Grade 11 to Grade 12':'Archive graduating Grade 12 students'}</p></div>
      <label>Current section<select value={source} disabled={!sourceOptions.length} onChange={e=>chooseSource(e.target.value)}><option value="">{sourceOptions.length?'Choose a section':'No sections available'}</option>{sourceOptions.map(s=><option value={s.scope_id} key={s.scope_id}>{s.name}</option>)}</select></label>
      {!sourceOptions.length&&<p className="cohort-inline-notice">No assigned {action==='promote'?'Grade 11':'Grade 12'} sections are available. Check your section assignments.</p>}
      <label>Current school year<input value={year} maxLength={9} placeholder="e.g. 2026-2027" aria-invalid={!!year&&!validAcademicYear(year)} aria-describedby="cohort-year-hint" onChange={e=>{setYear(e.target.value);setSelected([]);setReview(null);setError('');}}/></label>
      <p id="cohort-year-hint" className={year&&!validAcademicYear(year)?'cohort-inline-notice':'cohort-field-hint'}>{year&&!validAcademicYear(year)?'Use consecutive years, e.g. 2026-2027.':action==='promote'&&nextYear?'Next school year: '+nextYear:'Use the school year students are currently enrolled in.'}</p>
      {action==='promote'&&<><label>New Grade 12 section<select value={target} disabled={!destinations.length} onChange={e=>{setTarget(e.target.value);reset();}}><option value="">{destinations.length?'Choose a destination':'No Grade 12 sections'}</option>{destinations.map(s=><option value={s.scope_id} key={s.scope_id}>{s.name}</option>)}</select></label>{!destinations.length&&<div className="cohort-inline-notice"><strong>A destination is needed</strong><p>Ask the Principal to add a Grade 12 section before promoting students.</p></div>}</>}
     </fieldset>
     <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>{action==='promote'?'Student accounts and learning progress are kept. Teaching assignments stay the same.':'Graduates leave active class lists. Their records and mobile access are kept.'}</p></div>
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
   </div>:<section className="cohort-card cohort-history" aria-labelledby="cohort-history-title">
    <div className="cohort-card-heading"><History size={20} aria-hidden="true"/><div><h2 id="cohort-history-title">Enrollment history</h2><p>Recorded promotions and graduations for your sections.</p></div><label>Section<select value={historySection} onChange={e=>setHistorySection(e.target.value)}><option value="">All authorized sections</option>{data.sections.map(s=><option key={s.scope_id} value={s.scope_id}>{s.name}</option>)}</select></label></div>
    {!historyPage.total?<div className="cohort-empty"><History size={30} strokeWidth={1.5} aria-hidden="true"/><h3>No changes recorded</h3><p>{historySection?'No enrollment changes match this section.':'Completed promotions and graduations will appear here.'}</p></div>:<div className="support-table-scroll" tabIndex={0} aria-label="Enrollment history"><table className="support-table cohort-table"><thead><tr><th scope="col">Student</th><th scope="col">Change</th><th scope="col">Sections</th><th scope="col">School years</th><th scope="col">Recorded</th></tr></thead><tbody>{historyPage.items.map(h=><tr key={h.id}><th scope="row">{h.studentName||'Learner'}</th><td><span className="cohort-readiness">{h.action==='promote'?'Promoted':'Graduated'}</span></td><td>{h.sourceName}<small>{h.targetName?'To '+h.targetName:'Archived'}</small></td><td>{h.from_year}<small>{h.to_year&&'To '+h.to_year}</small></td><td>{new Date(h.created_at).toLocaleString()}</td></tr>)}</tbody></table></div>}
    <SupportPagination state={historyPage}/><p className="cohort-list-note">Outgoing students remain in this history. Access to their new section stays restricted to assigned staff.</p>
   </section>}
  </>}
  {review&&<SupportDialog title={review.action==='promote'?'Review promotion':'Review graduation'} busy={busy} onClose={()=>{setReview(null);setError('');}}>
   <div className="cohort-review"><p><strong>{review.students.length} students</strong> will {review.action==='promote'?'move to Grade 12.':'be archived as graduated.'}</p>
    <dl className="cohort-review-route"><div><dt>Current enrollment</dt><dd>{data.sections.find(s=>s.scope_id===review.sourceId)?.name}<small>{review.action==='promote'?'Grade 11':'Grade 12'} / {review.fromYear}</small></dd></div><div><dt>{review.action==='promote'?'New enrollment':'After graduation'}</dt><dd>{review.action==='promote'?destinations.find(s=>s.scope_id===review.targetId)?.name:'Graduated'}<small>{review.action==='promote'?'Grade 12 / '+review.toYear:'Removed from active class lists'}</small></dd></div></dl>
    <h3>Selected students</h3><ul className="cohort-review-list">{reviewPage.items.map(s=><li key={s._id}>{s.name}</li>)}</ul><SupportPagination state={reviewPage}/>
    <div className="cohort-preservation"><Info size={16} aria-hidden="true"/><p>{review.action==='promote'?'These students will leave the active Grade 11 roster.':'Mobile access stays available.'} Accounts, learning progress, and past records are preserved.</p></div>
    {error&&<div role="alert" className="cohort-notice is-error"><p>{error}</p><WorkspaceButton disabled={busy} onClick={()=>setRevision(v=>v+1)}>Reload checklist</WorkspaceButton></div>}
    <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={()=>{setReview(null);setError('');}}>Back to selection</WorkspaceButton><WorkspaceButton variant="primary" disabled={busy} onClick={apply}>{busy?'Applying...':review.action==='promote'?'Confirm promotion':'Confirm graduation'}</WorkspaceButton></footer>
   </div>
  </SupportDialog>}
 </div>;
}
