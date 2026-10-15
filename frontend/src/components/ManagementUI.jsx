import {WorkspaceButton} from './WorkspaceUI';
import {useEffect,useState} from 'react';
import {SupportDialog,SupportPagination,useSupportPage} from './SupportUI';
import {apiRequest} from '../utils/api';
import '../styles/support.css';
import '../styles/management.css';
export {SupportDialog as ManagementDialog,SupportPagination as ManagementPagination,useSupportPage as useManagementPage};
export function useDirectory(sources){
 const [data,setData]=useState({}),[loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);setError('');
  Promise.all(Object.entries(sources).map(async([key,url])=>{const rows=await apiRequest(url,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});if(!Array.isArray(rows))throw new Error('Unexpected directory response.');return [key,rows];})).then(rows=>{if(!controller.signal.aborted)setData(Object.fromEntries(rows));}).catch(e=>{if(!controller.signal.aborted)setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();
 },[sources,revision]);
 return {data,loading,error,refresh:()=>setRevision(v=>v+1)};
}
export function DirectoryState({loading,error,refresh,children}){return loading?<p className="support-empty" role="status">Loading records…</p>:error?<p className="support-error" role="alert">{error} <WorkspaceButton  onClick={refresh}>Retry</WorkspaceButton></p>:children;}
export function ContactFields({form,setForm,disabled=false}){
 const field=(key,value)=>setForm(v=>({...v,[key]:value}));
 return <><div className="management-name-fields"><label>First name<input required maxLength={100} value={form.firstName} disabled={disabled} onChange={e=>field('firstName',e.target.value)}/></label><label>Middle initial<input maxLength={1} value={form.middleInitial} disabled={disabled} onChange={e=>field('middleInitial',e.target.value)}/></label><label>Last name<input required maxLength={100} value={form.lastName} disabled={disabled} onChange={e=>field('lastName',e.target.value)}/></label></div><label>Email address<input type="email" required maxLength={254} value={form.email} disabled={disabled} onChange={e=>field('email',e.target.value)}/></label></>;
}
export const contactForm=person=>({firstName:person?.firstName||'',lastName:person?.lastName||'',middleInitial:person?.middleInitial||'',email:person?.email||'',technical:!!person?.technical});
export function CredentialsDialog({credentials,onClose}){
 const [message,setMessage]=useState('');
 return <SupportDialog title="Account created" onClose={onClose}><p>Share these temporary sign-in details with {credentials.name}. {credentials.role==='admin'?'They must also enter the code sent to their email and choose a new password before accessing the console.':'They will change the password after signing in.'}</p>{credentials.role==='admin'&&<p role="status" className={credentials.invitationEmailSent?'':'support-error'}>{credentials.invitationEmailSent?'Activation code sent to the teacher’s email. It expires in 10 minutes; they can request another on the sign-in screen.':'Account created, but the activation email could not be sent. Share the temporary password; the teacher can use Resend code after signing in. Check your email service settings if delivery keeps failing.'}</p>}{credentials.role==='admin'&&credentials.temporaryPasswordStored===false&&<p role="alert" className="support-error">The password preview could not be saved. Copy this temporary password now; it will not be available after closing this dialog.</p>}<div className="support-context"><strong>{credentials.email}</strong><p className="management-password">{credentials.generatedPassword}</p><WorkspaceButton  onClick={async()=>{try{await navigator.clipboard.writeText(credentials.generatedPassword);setMessage('Password copied.');}catch{setMessage('Could not copy. Select the password and copy it manually.');}}}>Copy password</WorkspaceButton></div>{message&&<p role="status">{message}</p>}<footer className="support-dialog-actions"><WorkspaceButton variant="primary" onClick={onClose}>Done</WorkspaceButton></footer></SupportDialog>;
}
