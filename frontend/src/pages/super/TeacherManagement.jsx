import FacultyHandoff from '../../components/FacultyHandoff';
import {useWorkspaceData} from '../../context/WorkspaceDataContext';
import TeacherPasswordPreview from '../../components/TeacherPasswordPreview';
import {WorkspaceButton,RefreshButton,SegmentedControl} from '../../components/WorkspaceUI';
import {useState} from 'react';
import {Plus,Info,Eye,Settings2,ArrowRightLeft,Pencil,GraduationCap,UserCog,KeyRound,LockKeyhole,LockKeyholeOpen} from 'lucide-react';
import {apiRequest} from '../../utils/api';
import {ManagementDialog,ManagementPagination,useManagementPage,useDirectory,DirectoryState,ContactFields,contactForm,CredentialsDialog} from '../../components/ManagementUI';
const ROLE_VIEWS=[['','All staff'],['Teacher','Teachers'],['Head Admin','Head Admins']];
function RoleBadge({role}){
 return <span className={'faculty-role '+(role==='Head Admin'?'faculty-role-head':'faculty-role-teacher')}>{role}</span>;
}
function StaffAction({icon:Icon,title,hint,onClick,caution}){
 return <WorkspaceButton className={`faculty-action${caution?' faculty-action-caution':''}`} onClick={onClick}>
  <Icon size={18} aria-hidden="true"/><span><strong>{title}</strong><small>{hint}</small></span>
 </WorkspaceButton>;
}
function SectionChoices({sections,ids,onChange}){
 return <div className="management-section-list">{!sections.length?<p>No sections available. Create a section or ask the Principal for an assignment.</p>:sections.map(s=><label key={s.id} className="management-check">
  <input type="checkbox" checked={ids.includes(s.id)} onChange={e=>onChange(e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/>{s.name} · {s.gradeLevel||'Grade unconfirmed'}
 </label>)}</div>;
}
const sources={teachers:'/api/teachers',sections:'/api/sections',students:'/api/students'};
export default function TeacherManagement({user}){
 const principal=user?.role==='super';
 const workspace=useWorkspaceData();
 const [handoff,setHandoff]=useState(null);
 const [tierChange,setTierChange]=useState(null),[roleFilter,setRoleFilter]=useState('');
 const nextRole=tierChange?.roleLabel==='Head Admin'?'Teacher':'Head Admin';
 async function saveTier(e){
  e.preventDefault();if(!tierChange||busy)return;
  setBusy(true);setError('');
  try{await apiRequest('/api/teachers/'+encodeURIComponent(tierChange._id)+'/role',{method:'PATCH',body:JSON.stringify({tier:nextRole==='Head Admin'?'subadmin':'teacher'})});
   setTierChange(null);setMessage(`${tierChange.name} is now a ${nextRole}.`);state.refresh();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 const state=useDirectory(sources),teachers=state.data.teachers||[],sections=state.data.sections||[],students=state.data.students||[];
 const [passwordPreview,setPasswordPreview]=useState(null);
 const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[section,setSection]=useState(''),[grade,setGrade]=useState(''),[info,setInfo]=useState(false),[form,setForm]=useState(null),[access,setAccess]=useState(null),[preview,setPreview]=useState(null),[credentials,setCredentials]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const filtered=teachers.filter(t=>(!principal||!roleFilter||t.roleLabel===roleFilter)&&(!status||t.status===status)&&(!section||t.sectionIds.includes(section))&&(!grade||t.grades.includes(grade))&&`${t.name} ${t.email}`.toLowerCase().includes(query.trim().toLowerCase()));
 const page=useManagementPage(filtered,`${roleFilter}|${query}|${status}|${section}|${grade}`);
 const [managed,setManaged]=useState(null);
 function manageAction(action){setManaged(null);action();}
 const previewStudents=students.filter(s=>preview?.sectionIds.includes(s.sectionId)),previewPage=useManagementPage(previewStudents,preview?._id);
 function openAccess(t,action){setError('');setAccess({...t,originalStatus:t.status,status:action==='deactivate'?'Inactive':action==='reactivate'?'Active':t.status,action});}
 function edit(t,tier='teacher'){setError('');setForm({...contactForm(t),id:t?._id,hadProfile:!!(t?.birthday||t?.contact_number),tier,sectionIds:t?.sectionIds||[],birthday:t?.birthday||'',contactNumber:t?.contact_number||''});}
 const memberTitle=form?.tier==='subadmin'?'Head Admin':'Teacher';
 async function save(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const basic=contactForm(form);
  const profile=(form.id&&!form.hadProfile&&!form.birthday&&!form.contactNumber)?{}:{birthday:form.birthday,contactNumber:form.contactNumber};
  const payload={...basic,...profile,...(!form.id&&{tier:form.tier,sectionIds:form.sectionIds})};
  const result=await apiRequest(form.id?`/api/teachers/${encodeURIComponent(form.id)}/details`:'/api/teachers',{method:form.id?'PATCH':'POST',body:JSON.stringify(payload)});setMessage(form.id?'Staff details updated.':memberTitle+' account created with the selected sections.');if(result.generatedPassword){if(principal&&result.temporaryPasswordStored){const {generatedPassword,...invitation}=result;setPasswordPreview(invitation);}else setCredentials(result);}setForm(null);state.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function saveAccess(e){e.preventDefault();if(busy)return;setBusy(true);setError('');try{await apiRequest(`/api/teachers/${encodeURIComponent(access._id)}`,{method:'PATCH',body:JSON.stringify({status:access.status,sectionIds:access.sectionIds})});setMessage(access.action==='deactivate'?'Teacher deactivated. Sign-in and existing sessions are blocked. Assignments and history are preserved.':access.action==='reactivate'?'Teacher access restored. Teachers with an unfinished invitation must still verify their email and set a password.':'Teacher access and section assignments updated.');setAccess(null);state.refresh();}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <div className="dashboard support-workspace"><header className="support-page-heading"><div><h1>{principal?'Staff accounts':'Section faculty'}</h1><p>{principal?'Manage faculty roles, section assignments, and access.':'Faculty teaching in your assigned sections.'}</p></div><div className="management-actions">{principal&&<WorkspaceButton onClick={()=>setInfo(true)}><Info size={16}/>Staff account guide</WorkspaceButton>}<WorkspaceButton variant="primary" disabled={state.loading||!!state.error} onClick={()=>edit()}><Plus size={16}/>Add Staff</WorkspaceButton></div></header>{message&&<p className="support-success" role="status">{message}</p>}
 <section className="support-panel">
 {principal&&<div className="faculty-role-filter"><SegmentedControl label="Filter staff by role" options={ROLE_VIEWS.map(([value,label])=>({value,label}))} value={roleFilter} onChange={setRoleFilter}/></div>}
 <div className="support-filters"><label className="support-search">Find a staff member<input type="search" placeholder="Name or email…" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Account status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">All statuses</option>{['Active','Invited','Inactive'].map(v=><option key={v}>{v}</option>)}</select></label><label>Grade<select value={grade} onChange={e=>{setGrade(e.target.value);setSection('');}}><option value="">All grades</option><option>Grade 11</option><option>Grade 12</option></select></label><label>Section<select value={section} onChange={e=>setSection(e.target.value)}><option value="">All sections</option>{sections.filter(s=>!grade||s.gradeLevel===grade).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div><div className="support-section-heading"><p>Co-teachers can share a section.</p><RefreshButton loading={state.loading} onClick={state.refresh}/></div><DirectoryState {...state}>{!filtered.length?<p className="support-empty">No staff members match these filters.</p>:<div className="support-table-scroll" tabIndex={0} aria-label="Staff directory"><table className="support-table management-table"><thead><tr><th>Staff member</th><th>Access</th><th>Assignments</th><th>Actions</th></tr></thead><tbody>{page.items.map(t=>{
  return <tr key={t._id}>
   <th scope="row">{t.name}<small>{t.email}</small><RoleBadge role={t.roleLabel}/></th>
   <td><span className={`support-status ${t.status==='Active'?'is-active':t.status==='Inactive'?'is-inactive':'is-invited'}`}>{t.status}</span></td>
   <td>{t.sections} sections · {t.students} active students<small>{t.grades.join(', ')||'No grade assigned'}</small></td>
   <td><div className="faculty-row-actions">
    <WorkspaceButton aria-label={`View profile for ${t.name}`} onClick={()=>setPreview(t)}><Eye size={16} aria-hidden="true"/>View profile</WorkspaceButton>
    {(principal||t.roleLabel==='Teacher')&&<WorkspaceButton aria-label={`Manage account for ${t.name}`} aria-haspopup="dialog" onClick={()=>setManaged(t)}><Settings2 size={16} aria-hidden="true"/>Manage account</WorkspaceButton>}
   </div></td></tr>;
 })}</tbody></table></div>}<ManagementPagination state={page}/></DirectoryState></section>{principal&&<p className="dash-footnote">Deactivate accounts to remove access while keeping teaching and review history.</p>}
 {managed&&<ManagementDialog title="Manage account" onClose={()=>setManaged(null)}>
  <div className="faculty-manage-summary"><span className="faculty-manage-avatar" aria-hidden="true">{managed.name?.trim().charAt(0).toUpperCase()}</span><div><strong>{managed.name}</strong><small>{managed.email}</small><RoleBadge role={managed.roleLabel}/></div></div>
  <section className="faculty-action-panel" aria-label="Account actions">
   <h3>Profile & teaching</h3><div className="faculty-action-grid">
    {principal&&<><StaffAction icon={Pencil} title="Edit details" hint="Update their name, email or contact details." onClick={()=>manageAction(()=>edit(managed))}/>
    <StaffAction icon={GraduationCap} title="Assign sections" hint="Choose the classes they teach." onClick={()=>manageAction(()=>openAccess(managed))}/>
    <StaffAction icon={UserCog} title="Change role" hint="Choose Teacher or Head Admin." onClick={()=>manageAction(()=>{setError('');setTierChange(managed);})}/></>}
    {managed.sectionIds.length>0&&<StaffAction icon={ArrowRightLeft} title="Transfer or cover" hint="Move a class, arrange cover or end an assignment." onClick={()=>manageAction(()=>setHandoff(managed))}/>}
   </div>
   {principal&&<><h4>Sign-in access</h4><div className="faculty-action-grid">
    {managed.status==='Invited'&&<StaffAction icon={KeyRound} title="Temporary password" hint="View their first sign-in password." onClick={()=>manageAction(()=>setPasswordPreview(managed))}/>}
    {managed.status==='Inactive'?<StaffAction icon={LockKeyholeOpen} title="Reactivate account" hint="Let them sign in again." onClick={()=>manageAction(()=>openAccess(managed,'reactivate'))}/>:<StaffAction icon={LockKeyhole} title="Deactivate account" hint="Block sign-in. Keep their records." caution onClick={()=>manageAction(()=>openAccess(managed,'deactivate'))}/>}
   </div></>}
  </section>
 </ManagementDialog>}

 {handoff&&<FacultyHandoff teacher={handoff} sections={sections} onClose={()=>setHandoff(null)} onSaved={()=>{setHandoff(null);setMessage('Teaching assignments updated. Student enrollment and learning history are unchanged.');state.refresh();workspace.refresh();}}/>}
 {tierChange&&<ManagementDialog title={`Change ${tierChange.name}’s role?`} busy={busy} onClose={()=>setTierChange(null)}>
  <form className="support-form" onSubmit={saveTier}>
   <dl className="faculty-role-change"><div><dt>Current role</dt><dd><RoleBadge role={tierChange.roleLabel}/></dd></div><div><dt>New role</dt><dd><RoleBadge role={nextRole}/></dd></div></dl>
   <p>{nextRole==='Head Admin'?'They’ll keep their classes and can also see who teaches in their sections.':'They’ll keep their classes but will no longer see the list of other teachers in their sections.'}</p>
   {error&&<p role="alert" className="support-error">{error}</p>}
   <footer className="support-dialog-actions"><WorkspaceButton disabled={busy} onClick={()=>setTierChange(null)}>Cancel</WorkspaceButton><WorkspaceButton disabled={busy} type="submit" variant="primary">{busy?'Saving…':`Change to ${nextRole}`}</WorkspaceButton></footer>
  </form>
 </ManagementDialog>}
 {info&&<ManagementDialog title="Faculty access & section assignments" onClose={()=>setInfo(false)}><div className="support-form"><p><strong>Add a teacher:</strong> Share the generated temporary password. A separate verification code is emailed to the teacher. They must enter it and choose a new password before accessing the console.</p><p><strong>Assign sections:</strong> Choose their sections when adding the account. To change them later, use Manage account → Assign sections; multiple teachers may share a section. Grades and student counts come from these assignments.</p><p><strong>Control access:</strong> Teachers see students and records only in assigned sections. Deactivating a teacher blocks existing sessions too. Under Manage account, choose Deactivate account or Reactivate account. Their past reviews and interventions stay recorded.</p><p><strong>Review details:</strong> View profile shows their sections and students. Under Manage account, Edit details changes their name or email.</p></div></ManagementDialog>}
 {form&&<ManagementDialog title={form.id?'Edit staff details':'Add Staff'} busy={busy} onClose={()=>setForm(null)}>
  <form className="support-form faculty-form" onSubmit={save}><fieldset disabled={busy} className="support-form">
   {!form.id&&<p className="faculty-form-intro">Set up their profile and teaching access. An email code will help them activate their account.</p>}
   {!form.id&&<section className="faculty-type-picker" aria-label="Staff role"><span className="workspace-control-label">Account type</span>{principal?<SegmentedControl label="Staff account type" options={[{value:'teacher',label:'Teacher'},{value:'subadmin',label:'Head Admin'}]} value={form.tier} onChange={tier=>setForm(v=>({...v,tier}))}/>:<RoleBadge role="Teacher"/>}<p>{form.tier==='subadmin'?'Teaches assigned sections and manages staff within those sections.':'Teaches assigned sections and supports their students.'}</p></section>}
   <section className="faculty-form-section" aria-labelledby="staff-personal-heading"><h3 id="staff-personal-heading">Personal details</h3><ContactFields form={form} setForm={setForm} showRequirements/>
    <div className="faculty-contact-fields"><label>Birthday{!form.id&&<small className="field-requirement">Required</small>}<input type="date" min="1900-01-01" max={new Date().toISOString().slice(0,10)} required={!form.id||form.hadProfile||!!form.birthday||!!form.contactNumber} value={form.birthday} onChange={e=>setForm(v=>({...v,birthday:e.target.value}))}/></label><label>Contact number{!form.id&&<small className="field-requirement">Required</small>}<input type="tel" required={!form.id||form.hadProfile||!!form.birthday||!!form.contactNumber} maxLength={26} placeholder="e.g. 0917 123 4567" value={form.contactNumber} onChange={e=>setForm(v=>({...v,contactNumber:e.target.value}))}/></label></div>
   </section>
   {!form.id&&<section className="faculty-form-section" aria-labelledby="staff-sections-heading"><div className="faculty-form-section-heading"><h3 id="staff-sections-heading">Teaching assignments</h3><span>{form.sectionIds.length} selected</span></div><p>Select at least one section. Co-teachers can share a class.</p><SectionChoices sections={sections} ids={form.sectionIds} onChange={sectionIds=>setForm(v=>({...v,sectionIds}))}/></section>}
   {error&&<p role="alert" className="support-error">{error}</p>}
   <footer className="support-dialog-actions"><WorkspaceButton type="button" onClick={()=>setForm(null)}>Cancel</WorkspaceButton><WorkspaceButton type="submit" variant="primary" disabled={!form.id&&!form.sectionIds.length}>{busy?'Saving…':form.id?'Save details':'Add '+memberTitle}</WorkspaceButton></footer>
  </fieldset></form>
 </ManagementDialog>}
 {access&&<ManagementDialog title={`${access.action==='deactivate'?'Deactivate account':access.action==='reactivate'?'Reactivate account':'Assign sections'} · ${access.name}`} busy={busy} onClose={()=>setAccess(null)}><form className="support-form" onSubmit={saveAccess}><fieldset disabled={busy} className="support-form">{access.action==='deactivate'&&<p className="support-error">Saving will block this teacher from signing in and using existing sessions. Their history and selected assignments are retained.</p>}{access.action==='reactivate'&&<p>Restore this teacher’s access to their assigned sections. If they have not completed their invitation, email verification and password setup are still required.</p>}<fieldset className="support-form" disabled={!!access.action}><legend>Assigned sections{access.action?' (preserved)':''}</legend><SectionChoices sections={sections} ids={access.sectionIds} onChange={sectionIds=>setAccess(v=>({...v,sectionIds}))}/></fieldset><p>{access.sectionIds.length} sections selected. {access.action?'This action preserves section assignments and all teaching and review history.':'Removing an assignment removes access to that section’s students and reports.'}</p>{error&&<p className="support-error" role="alert">{error}</p>}<footer className="support-dialog-actions"><WorkspaceButton type="button"  onClick={()=>setAccess(null)}>Cancel</WorkspaceButton><WorkspaceButton type="submit" variant="primary">{busy?'Saving…':access.action==='deactivate'?'Deactivate account':access.action==='reactivate'?'Reactivate account':'Save sections'}</WorkspaceButton></footer></fieldset></form></ManagementDialog>}
 {preview&&<ManagementDialog title={preview.name} onClose={()=>setPreview(null)}><div className="support-context"><RoleBadge role={preview.roleLabel}/> <strong>{preview.status}{preview.email&&' · '+preview.email}</strong>{principal&&<p>Birthday: {preview.birthday||"Not recorded"} · Contact: {preview.contact_number||"Not recorded"}</p>}<p>{preview.sectionIds.map(id=>sections.find(s=>s.id===id)?.name||'Unavailable section').join(', ')||'No assigned sections'}</p></div><h3>Active students in assigned sections</h3>{!previewStudents.length?<p>No active students in these assignments.</p>:<ul className="management-preview-list">{previewPage.items.map(s=><li key={s._id}><strong>{s.name}</strong><p>{s.section} · {s.gradeLevel} · {s.email}</p></li>)}</ul>}<ManagementPagination state={previewPage}/></ManagementDialog>}
 {passwordPreview&&<TeacherPasswordPreview teacher={passwordPreview} onClose={()=>setPasswordPreview(null)}/>}
 {credentials&&<CredentialsDialog credentials={credentials} onClose={()=>setCredentials(null)}/>}
 </div>;
}
