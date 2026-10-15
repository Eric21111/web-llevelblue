import {useEffect,useState} from 'react';
import {ManagementDialog} from './ManagementUI';
import {WorkspaceButton} from './WorkspaceUI';
import {apiRequest} from '../utils/api';

export default function TeacherPasswordPreview({teacher,onClose}){
 const [credential,setCredential]=useState(null),[error,setError]=useState(''),[revealed,setRevealed]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{
  let stopped=false,timer,controller;
  async function load(){
   controller=new AbortController();
   try{
    const data=await apiRequest(`/api/teachers/${encodeURIComponent(teacher._id)}/temporary-password`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(stopped)return;
    setCredential(data);setError('');
    if(!data.available){setRevealed(false);setMessage('');return;}
   }catch(e){if(stopped)return;setCredential(null);setRevealed(false);setError(e.message);}
   if(!stopped)timer=setTimeout(load,5000);
  }
  load();
  function hide(){if(document.hidden){setRevealed(false);setMessage('');}}
  document.addEventListener('visibilitychange',hide);
  return()=>{stopped=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',hide);};
 },[teacher._id]);
 async function copy(){
  try{
   // Recheck availability before copying instead of trusting an earlier preview.
   const data=await apiRequest(`/api/teachers/${encodeURIComponent(teacher._id)}/temporary-password`);
   setCredential(data);
   if(!data.available){setRevealed(false);setMessage('');return;}
   await navigator.clipboard.writeText(data.password);setMessage('Temporary password copied.');
  }catch{setMessage('Could not copy. Reveal the password and copy it manually.');}
 }
 return <ManagementDialog title={`Temporary password · ${teacher.name}`} onClose={onClose}>
  <div className="support-form"><p>Share this temporary password with the teacher. Their email code is sent separately through Brevo.</p>
   <div className="support-context"><strong>{teacher.email}</strong></div>
   {typeof teacher.invitationEmailSent==='boolean'&&<p role="status" className={teacher.invitationEmailSent?'':'support-error'}>{teacher.invitationEmailSent?'Activation code sent to the teacher’s email.':'Account created, but the activation email could not be sent. The teacher can use Resend code after signing in with this temporary password.'}</p>}
   {error?<p className="support-error" role="alert">{error}</p>:!credential?<p role="status">Checking availability…</p>:credential.available?<>
    <p className="management-password" aria-label={revealed?'Temporary password':'Temporary password hidden'}>{revealed?credential.password:'••••••••••••'}</p>
    <div className="management-actions"><WorkspaceButton aria-pressed={revealed} onClick={()=>setRevealed(v=>!v)}>{revealed?'Hide password':'Reveal password'}</WorkspaceButton><WorkspaceButton onClick={copy}>Copy password</WorkspaceButton></div>
    <p>This preview is cleared when the teacher verifies their email. An open preview checks for updates every few seconds.</p>
   </>:<p role="status">{credential.message}</p>}
   {message&&<p role="status">{message}</p>}
   <footer className="support-dialog-actions"><WorkspaceButton onClick={onClose}>Close</WorkspaceButton></footer>
  </div>
 </ManagementDialog>;
}
