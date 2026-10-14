import {RefreshCw} from 'lucide-react';
import '../styles/workspace-controls.css';

export function WorkspaceButton({variant='secondary',className='',type='button',children,...props}){
 return <button type={type} className={`workspace-button ${variant==='primary'?'is-primary':''} ${className}`} {...props}>{children}</button>;
}
export function RefreshButton({loading=false,disabled=false,onClick,label='Refresh'}){
 return <WorkspaceButton onClick={onClick} disabled={loading||disabled} aria-busy={loading}><RefreshCw size={16} aria-hidden="true" className={loading?'is-spinning':''}/>{loading?'Refreshing…':label}</WorkspaceButton>;
}
export function ViewChoices({label='Choose a view',options,value,onChange}){
 return <div className="workspace-views" role="group" aria-label={label}>{options.map(({id,title,description})=><WorkspaceButton key={id} aria-pressed={value===id} onClick={()=>onChange(id)}><strong>{title}</strong>{description&&<small>{description}</small>}</WorkspaceButton>)}</div>;
}
