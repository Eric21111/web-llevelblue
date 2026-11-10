import WorkspaceSelect from './WorkspaceSelect';
import {useWorkspaceQuery} from '../hooks/useWorkspaceQuery';
import {useState} from 'react';
import {apiRequest} from '../utils/api';
export default function FacultyAssignments(){
 const [teacherId,setTeacherId]=useState(''),[ids,setIds]=useState([]),[status,setStatus]=useState('Active'),[actionError,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const {data:{teachers=[],sections=[]},errors}=useWorkspaceQuery({teachers:'/api/teachers',sections:'/api/sections'});
 const error=actionError||Object.values(errors)[0];
 const teacher=teachers.find(t=>t._id===teacherId);
 function choose(value){const t=teachers.find(t=>t._id===value);setTeacherId(value);setIds(t?.sectionIds||[]);setStatus(t?.status||'Active');setMessage('');}
 async function save(e){e.preventDefault();setBusy(true);setError('');try{await apiRequest(`/api/teachers/${teacherId}`,{method:'PATCH',body:JSON.stringify({status,sectionIds:ids})});setMessage('Teacher access and assignments saved.');}catch(e){setError(e.message);}finally{setBusy(false);}}
 return <section className="learning-card learning-workspace"><h2>Faculty access & section assignments</h2><p>Each section can have multiple teachers. Grades and student counts follow these assignments. Inactive teachers lose access on their next request.</p>{error&&<p role="alert" className="learning-alert">{error}</p>}{message&&<p role="status">{message}</p>}<form className="learning-form" onSubmit={save}><label>Teacher<WorkspaceSelect value={teacherId} onChange={e=>choose(e.target.value)} required><option value="">Select a teacher</option>{teachers.map(t=><option key={t._id} value={t._id}>{t.name} · {t.status}</option>)}</WorkspaceSelect></label>{teacher&&<><label>Account status<WorkspaceSelect value={status} onChange={e=>setStatus(e.target.value)}>{teacher.status==='Invited'?<option>Invited</option>:<option>Active</option>}<option>Inactive</option></WorkspaceSelect></label><fieldset><legend>Assigned sections</legend>{!sections.length?<p>Create a section first.</p>:sections.map(s=><label className="learning-check" key={s.id}><input type="checkbox" checked={ids.includes(s.id)} onChange={e=>setIds(e.target.checked?[...ids,s.id]:ids.filter(id=>id!==s.id))}/><span>{s.name} · {s.gradeLevel||'Grade unconfirmed'}</span></label>)}</fieldset><button className="learning-button" disabled={busy}>{busy?'Saving…':'Save access & assignments'}</button></>}</form></section>;
}
