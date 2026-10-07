import {useEffect,useState} from 'react';
import {apiRequest} from '../utils/api';
export default function SectionWorkspace({user}) {
 const [sections,setSections]=useState([]),[name,setName]=useState(''),[grade,setGrade]=useState('Grade 11');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
 const [choices,setChoices]=useState({}),[sectionErrors,setSectionErrors]=useState({}),[message,setMessage]=useState('');
 async function load(){
  setLoading(true);setError('');
  try{setSections(await apiRequest('/api/sections'));}catch(e){setError(e.message);}finally{setLoading(false);}
 }
 useEffect(()=>{load();},[]);
 async function create(e){e.preventDefault();setBusy(true);setError('');setMessage('');try{await apiRequest('/api/sections',{method:'POST',body:JSON.stringify({name,gradeLevel:grade})});setName('');setMessage('Section created.');await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
 async function confirm(e,id){
  e.preventDefault();setBusy(true);setMessage('');setSectionErrors(v=>({...v,[id]:''}));
  try{
   await apiRequest('/api/sections/'+encodeURIComponent(id),{method:'PATCH',body:JSON.stringify({gradeLevel:choices[id]})});
   setMessage('Section grade confirmed. Students without a recorded grade now use this section grade in the workspace.');
   await load();
  }catch(e){setSectionErrors(v=>({...v,[id]:e.message}));}finally{setBusy(false);}
 }
 return <div className="dashboard learning-workspace">
  <div className="dash-page-intro"><span className="dash-eyebrow">CLASSROOM ORGANIZATION</span><h1>Sections & assignments</h1><p>{user?.role==='super'?'Create sections and assign co-teachers from Teacher Accounts.':'You are automatically assigned to sections you create. The school head manages co-teachers.'}</p></div>
  {error&&<p className="learning-alert" role="alert">{error} <button onClick={load} disabled={busy||loading}>Reload sections</button></p>}
  {message&&<p className="learning-success" role="status">{message}</p>}
  <div className="learning-two-col">
   <section className="learning-card"><h2>Create a section</h2><form className="learning-form" onSubmit={create}><label>Section name<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Grade 11 – Emerald"/></label><label>Grade<select value={grade} onChange={e=>setGrade(e.target.value)}><option>Grade 11</option><option>Grade 12</option></select></label><button className="learning-button" disabled={busy}>{busy?'Saving…':'Create section'}</button></form></section>
   <section className="learning-card"><h2>{user?.role==='super'?'School sections':'Your assigned sections'}</h2>
    {loading?<p role="status">Loading sections…</p>:!sections.length?<p>No assigned sections yet.</p>:sections.map(s=><article className="learning-note" key={s.id}>
     <strong>{s.name}</strong><p>{s.gradeLevel||'Grade needs confirmation'} · {s.subject}</p>
     {user?.role==='super'&&!s.gradeLevel&&<form className="learning-form" onSubmit={e=>confirm(e,s.id)}>
      <label>Grade for {s.name}<select required value={choices[s.id]||''} disabled={busy} onChange={e=>{setChoices(v=>({...v,[s.id]:e.target.value}));setSectionErrors(v=>({...v,[s.id]:''}));}}><option value="" disabled>Choose grade</option><option>Grade 11</option><option>Grade 12</option></select></label>
      <p>Students with no recorded grade will use the confirmed section grade. Existing student grades and learning progress are preserved.</p>
      {sectionErrors[s.id]&&<p className="learning-alert" role="alert">{sectionErrors[s.id]}</p>}
      <button className="learning-button" disabled={busy||!choices[s.id]}>{busy?'Saving…':'Confirm section grade'}</button>
     </form>}
    </article>)}
   </section>
  </div><p className="dash-footnote">Student accounts and learning history are preserved. Promotion and graduation archival are pending mobile synchronization checks.</p>
 </div>;
}
