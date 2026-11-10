import '../styles/workspace-controls.css';

export function WorkspaceButton({variant='secondary',className='',type='button',children,...props}){
 return <button type={type} className={`workspace-button ${variant==='primary'?'is-primary':''} ${className}`} {...props}>{children}</button>;
}
export function ViewChoices({label='Choose a view',options,value,onChange}){
 return <div className="workspace-views" role="group" aria-label={label}>{options.map(({id,title,description})=><WorkspaceButton key={id} aria-pressed={value===id} onClick={()=>onChange(id)}><strong>{title}</strong>{description&&<small>{description}</small>}</WorkspaceButton>)}</div>;
}

// Shared animated choice control for short, mutually exclusive filters.
export function SegmentedControl({label,options,value,onChange,disabled=false}){
 const selected=options.findIndex(option=>option.value===value);
 return <div className="workspace-segments" role="group" aria-label={label} style={{'--segment-count':options.length,'--segment-index':Math.max(0,selected)}}>
  {selected>=0&&<span className="workspace-segment-indicator" aria-hidden="true"/>}
  {options.map(option=><button key={option.value} type="button" disabled={disabled} aria-pressed={value===option.value} onClick={()=>onChange(option.value)}>{option.label}</button>)}
 </div>;
}
