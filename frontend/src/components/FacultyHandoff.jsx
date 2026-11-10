import WorkspaceSelect from './WorkspaceSelect';
import {useState} from 'react';
import {ManagementDialog,useDirectory,DirectoryState} from './ManagementUI';
import {WorkspaceButton,ViewChoices} from './WorkspaceUI';
import {apiRequest} from '../utils/api';
const sources={options:'/api/faculty/coverage-options'};
const actions=[
 {id:'transfer',title:'Move section',description:'Move one teaching assignment.'},
 {id:'replace',title:'Replace staff',description:'Hand this class to someone else.'},
 {id:'cover',title:'Add co-teacher',description:'Share access to this class.'},
 {id:'remove',title:'Remove assignment',description:'End teaching or cover for this class.'}
];
export default function FacultyHandoff({teacher,sections,onClose,onBack,onSaved}){
 const state=useDirectory(sources);
 const [action,setAction]=useState(teacher.status==='Active'?'transfer':'replace');
 const [source,setSource]=useState(teacher.sectionIds[0]||''),[target,setTarget]=useState(''),[replacement,setReplacement]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const sectionName=id=>sections.find(section=>section.id===id)?.name||'the selected section';
 const choices=(state.data.options||[]).filter(person=>String(person.id)!==String(teacher._id));
 const replacementName=choices.find(person=>String(person.id)===replacement)?.name||'Your selected replacement';
 const valid=source&&(action==='transfer'?target&&target!==source:action==='remove'||replacement);
 function changeAction(value){setAction(value);setTarget('');setReplacement('');setError('');}
 async function submit(event){
  event.preventDefault();if(!valid||busy)return;
  setBusy(true);setError('');
  try{
   await apiRequest('/api/teachers/'+encodeURIComponent(teacher._id)+'/handoff',{method:'POST',body:JSON.stringify({action,sourceId:source,targetId:action==='transfer'?target:null,replacementId:replacement||null})});
   onSaved();
  }catch(e){setError(e.message);}finally{setBusy(false);}
 }
 return <ManagementDialog onBack={onBack} title="Teaching assignments" onClose={onClose} busy={busy}>
  <p><strong>{teacher.name}</strong> · {teacher.roleLabel}</p>
  <DirectoryState {...state}><form className="support-form" onSubmit={submit}><fieldset disabled={busy} className="support-form">
   <ViewChoices label="Assignment action" options={actions.filter(item=>teacher.status==='Active'||item.id!=='transfer')} value={action} onChange={changeAction}/>
   <label>Current section<WorkspaceSelect required value={source} onChange={event=>{setSource(event.target.value);setTarget('');setReplacement('');setError('');}}>{sections.filter(section=>teacher.sectionIds.includes(section.id)).map(section=><option key={section.id} value={section.id}>{section.gradeLevel||'Grade unconfirmed'} · {section.name}</option>)}</WorkspaceSelect></label>
   {action==='transfer'&&<label>Move to<WorkspaceSelect required value={target} onChange={event=>setTarget(event.target.value)}><option value="">Choose a section</option>{sections.filter(section=>!teacher.sectionIds.includes(section.id)).map(section=><option key={section.id} value={section.id}>{section.gradeLevel||'Grade unconfirmed'} · {section.name}</option>)}</WorkspaceSelect></label>}
   {action!=='remove'&&<label>{action==='cover'?'Co-teacher':'Replacement in the current section'}<WorkspaceSelect required={action!=='transfer'} value={replacement} onChange={event=>setReplacement(event.target.value)}><option value="">{action==='transfer'?'Keep existing active co-teachers':'Choose active staff'}</option>{choices.map(person=><option key={person.id} value={person.id}>{person.name} · {person.roleLabel}</option>)}</WorkspaceSelect></label>}
   <div className="support-context faculty-handoff-summary" role="status"><strong>What will change</strong><p>{action==='cover'?`${replacementName} gains shared access to ${sectionName(source)}. ${teacher.name} keeps their assignment.`:`${teacher.name} loses access through their assignment to ${sectionName(source)}.${action==='transfer'?` They gain access to ${target?sectionName(target):'the destination section'}.`:''}${replacement?` ${replacementName} takes over ${sectionName(source)}.`:''}`}</p><p>{action==='cover'?'Co-teacher access continues until you remove their assignment.':'A section with active students must retain an active teacher or Head Admin.'} Student enrollment and learning history stay the same.</p></div>
   {error&&<p className="support-error" role="alert">{error}</p>}
   <footer className="support-dialog-actions"><WorkspaceButton onClick={onClose}>Cancel</WorkspaceButton><WorkspaceButton type="submit" variant="primary" disabled={!valid}>{busy?'Saving…':'Confirm assignment'}</WorkspaceButton></footer>
  </fieldset></form></DirectoryState>
 </ManagementDialog>;
}
