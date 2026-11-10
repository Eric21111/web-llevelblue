import {WorkspaceButton} from './WorkspaceUI';
import {useState} from 'react';
import {SupportDialog,SupportPagination,useSupportPage} from './SupportUI';
import {useDashboardData} from '../hooks/useDashboardData';
import Skeleton from './Skeleton';

import '../styles/support.css';
import '../styles/management.css';
export {SupportDialog as ManagementDialog,SupportPagination as ManagementPagination,useSupportPage as useManagementPage};
export {directorySourceKey} from '../utils/directory';
export function useDirectory(sources){
 const state=useDashboardData(sources);
 return {...state,error:Object.values(state.errors)[0]||''};
}
export function DirectoryState({loading,error,refresh,children}){return loading?<Skeleton label="Loading records"/>:error?<p className="support-error" role="alert">{error} <WorkspaceButton  onClick={refresh}>Retry</WorkspaceButton></p>:children;}
export function ContactFields({form,setForm,disabled=false,showRequirements=false}){
 const field=(key,value)=>setForm(v=>({...v,[key]:value}));
 return <><div className="management-name-fields"><label>First name{showRequirements&&<small className="field-requirement">Required</small>}<input required maxLength={100} value={form.firstName} disabled={disabled} onChange={e=>field('firstName',e.target.value)}/></label><label>Middle initial{showRequirements&&<small className="field-requirement">Optional</small>}<input maxLength={1} value={form.middleInitial} disabled={disabled} onChange={e=>field('middleInitial',e.target.value)}/></label><label>Last name{showRequirements&&<small className="field-requirement">Required</small>}<input required maxLength={100} value={form.lastName} disabled={disabled} onChange={e=>field('lastName',e.target.value)}/></label></div><label>Email address{showRequirements&&<small className="field-requirement">Required</small>}<input type="email" required maxLength={254} value={form.email} disabled={disabled} onChange={e=>field('email',e.target.value)}/></label></>;
}
export const contactForm=person=>({firstName:person?.firstName||'',lastName:person?.lastName||'',middleInitial:person?.middleInitial||'',email:person?.email||'',technical:!!person?.technical});
export function CredentialsDialog({credentials,onClose}){
 const [message,setMessage]=useState('');
 const invited=credentials.role==='admin'||credentials.role==='developer';
 const roleName=credentials.role==='developer'?'developer':credentials.roleLabel==='Head Admin'?'Head Admin':'teacher';
 return <SupportDialog title="Account created" onClose={onClose}><p>Share these temporary sign-in details with {credentials.name}. {invited?'They must also enter the code sent to their email and choose a new password before accessing the console.':'They will change the password after signing in.'}</p>{invited&&<p role="status" className={credentials.invitationEmailSent?'':'support-error'}>{credentials.invitationEmailSent?`Activation code sent to the ${roleName}’s email. It expires in 10 minutes; they can request another on the sign-in screen.`:`Account created, but the activation email could not be sent. Share the temporary password; the ${roleName} can use Resend code after signing in. Check your email service settings if delivery keeps failing.`}</p>}{invited&&credentials.temporaryPasswordStored===false&&<p role="alert" className="support-error">The password preview could not be saved. Copy this temporary password now; it will not be available after closing this dialog.</p>}<div className="support-context"><strong>{credentials.email}</strong><p className="management-password">{credentials.generatedPassword}</p><WorkspaceButton  onClick={async()=>{try{await navigator.clipboard.writeText(credentials.generatedPassword);setMessage('Password copied.');}catch{setMessage('Could not copy. Select the password and copy it manually.');}}}>Copy password</WorkspaceButton></div>{message&&<p role="status">{message}</p>}<footer className="support-dialog-actions"><WorkspaceButton variant="primary" onClick={onClose}>Done</WorkspaceButton></footer></SupportDialog>;
}
