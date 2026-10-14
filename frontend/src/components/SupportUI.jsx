import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
export function SupportDialog({title,onClose,busy,children}){
 const ref=useRef(null);
 useEffect(()=>{const previous=document.activeElement,dialog=ref.current;dialog.showModal();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="support-dialog support-workspace" aria-label={title} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><header className="support-dialog-heading"><h2>{title}</h2><button className="dash-button" onClick={onClose} disabled={busy} aria-label="Close dialog"><X size={18}/></button></header>{children}</dialog>;
}
export function useSupportPage(items,key){
 const [page,setPage]=useState(1),pages=Math.max(1,Math.ceil(items.length/10)),current=Math.min(page,pages);
 useEffect(()=>setPage(1),[key]);
 return {items:items.slice((current-1)*10,current*10),page:current,pages,total:items.length,setPage};
}
export function SupportPagination({state}){
 return <nav className="support-pagination" aria-label="Results pages"><span>{state.total?`${(state.page-1)*10+1}–${Math.min(state.page*10,state.total)}`:'0'} of {state.total}</span><div><button className="dash-button" disabled={state.page===1} onClick={()=>state.setPage(state.page-1)}>Previous</button><span>{state.page} / {state.pages}</span><button className="dash-button" disabled={state.page===state.pages} onClick={()=>state.setPage(state.page+1)}>Next</button></div></nav>;
}
export function SupportFilters({sections,grade,setGrade,section,setSection,query,setQuery,disabled=false}){
 return <div className="support-filters"><label className="support-search">Find a student<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name or section…" disabled={disabled}/></label><label>Grade<select value={grade} onChange={e=>{setGrade(e.target.value);setSection('');}} disabled={disabled}><option value="">All grades</option><option>Grade 11</option><option>Grade 12</option></select></label><label>Section<select value={section} onChange={e=>setSection(e.target.value)} disabled={disabled}><option value="">All available sections</option>{sections.filter(s=>!grade||s.gradeLevel===grade).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>;
}
