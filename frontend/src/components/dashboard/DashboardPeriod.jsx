import {useEffect,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {apiRequest} from '../../utils/api';

export const localDate=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function periodQuery(date,period){
 const [year,month,day]=date.split('-').map(Number);
 const start=new Date(year,period==='year'?0:month-1,period==='day'?day:1);
 const end=period==='year'?new Date(year+1,0,1):period==='month'?new Date(year,month,1):new Date(year,month-1,day+1);
 return {date,period,startOffset:String(start.getTimezoneOffset()),endOffset:String(end.getTimezoneOffset())};
}
export function periodLabel(date,period){return new Date(`${date}T12:00:00`).toLocaleDateString(undefined,period==='year'?{year:'numeric'}:period==='month'?{month:'long',year:'numeric'}:{month:'short',day:'numeric',year:'numeric'});}
const months=Array.from({length:12},(_,i)=>new Date(2024,i,1).toLocaleDateString(undefined,{month:'short'}));
function CalendarDialog({date,period,onSelect,onClose}){
 const dialog=useRef(null),[view,setView]=useState(()=>new Date(`${date}T12:00:00`)),[focused,setFocused]=useState(date);
 const year=view.getFullYear(),month=view.getMonth(),today=localDate(),decade=Math.floor(year/12)*12;
 useEffect(()=>{const previous=document.activeElement,node=dialog.current;node.showModal();return()=>{node.close();previous?.focus();};},[]);
 const choose=d=>{onSelect(localDate(d));onClose();};
 const moveMonth=n=>setView(new Date(year,month+n,1));
 const keyDay=(e,value)=>{let next=new Date(`${value}T12:00:00`);const delta={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-next.getDay(),End:6-next.getDay()}[e.key];if(delta===undefined)return;e.preventDefault();next.setDate(next.getDate()+delta);if(localDate(next)>today||next.getFullYear()<1900)return;const key=localDate(next);setView(next);setFocused(key);requestAnimationFrame(()=>dialog.current?.querySelector(`[data-date="${key}"]`)?.focus());};
 const firstDay=new Date(year,month,1).getDay(),days=new Date(year,month+1,0).getDate();
 return <dialog ref={dialog} className="dash-calendar" aria-label={`Choose ${period}`} onCancel={e=>{e.preventDefault();onClose();}}><header><h2>Choose {period}</h2><button className="dash-button" aria-label="Close calendar" onClick={onClose}><X size={17}/></button></header>
 <div className="dash-calendar-nav"><button className="dash-button" aria-label={`Previous ${period==='day'?'month':period==='month'?'year':'years'}`} disabled={year<=1900&&(period!=='day'||month===0)} onClick={()=>period==='day'?moveMonth(-1):setView(new Date(year-(period==='year'?12:1),month,1))}><ChevronLeft size={16}/></button>
 {period==='day'?<label><span className="dash-sr-only">Calendar month</span><select value={month} onChange={e=>setView(new Date(year,Number(e.target.value),1))}>{months.map((m,i)=><option key={m} value={i}>{m}</option>)}</select></label>:null}
 {period!=='year'?<label><span className="dash-sr-only">Calendar year</span><select value={year} onChange={e=>setView(new Date(Number(e.target.value),month,1))}>{Array.from({length:new Date().getFullYear()-1899},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y}>{y}</option>)}</select></label>:<strong>{decade}–{decade+11}</strong>}
 <button className="dash-button" aria-label={`Next ${period==='day'?'month':period==='month'?'year':'years'}`} disabled={period==='day'?new Date(year,month+1,1)>new Date():period==='month'?year>=new Date().getFullYear():decade+12>new Date().getFullYear()} onClick={()=>period==='day'?moveMonth(1):setView(new Date(year+(period==='year'?12:1),month,1))}><ChevronRight size={16}/></button></div>
 {period==='day'?<><div className="dash-calendar-week" aria-hidden="true">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><span key={d}>{d}</span>)}</div><div className="dash-calendar-grid">{Array.from({length:firstDay},(_,i)=><span key={`empty${i}`}/>)}{Array.from({length:days},(_,i)=>{const d=new Date(year,month,i+1),key=localDate(d);return <button key={key} data-date={key} aria-label={d.toLocaleDateString(undefined,{dateStyle:'full'})} aria-pressed={date===key} aria-current={key===today?'date':undefined} disabled={key>today} tabIndex={key===focused||(!focused.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)&&i===0)?0:-1} onKeyDown={e=>keyDay(e,key)} onClick={()=>choose(d)}>{i+1}</button>;})}</div></>:<div className="dash-calendar-periods">{Array.from({length:12},(_,i)=>{const d=period==='month'?new Date(year,i,1):new Date(decade+i,0,1);return <button key={i} disabled={localDate(d)>today||d.getFullYear()<1900} aria-pressed={period==='month'?date.startsWith(localDate(d).slice(0,7)):date.startsWith(String(decade+i))} onClick={()=>choose(d)}>{period==='month'?months[i]:decade+i}</button>;})}</div>}
 <footer><button className="dash-button" onClick={()=>choose(new Date())}>{period==='day'?'Today':period==='month'?'This month':'This year'}</button><small>Future periods are unavailable.</small></footer></dialog>;
}
export function DashboardDatePicker({date,period,onDate,onPeriod,disabled}){
 const [open,setOpen]=useState(false);
 return <><div className="dash-period-toggle" role="group" aria-label="Activity period">{['day','month','year'].map(p=><button key={p} disabled={disabled} aria-pressed={period===p} onClick={()=>onPeriod(p)}>{p[0].toUpperCase()+p.slice(1)}</button>)}</div><button className="dash-date" disabled={disabled} aria-haspopup="dialog" onClick={()=>setOpen(true)}><CalendarDays size={15}/>{periodLabel(date,period)}</button>{open&&<CalendarDialog date={date} period={period} onSelect={onDate} onClose={()=>setOpen(false)}/>}</>;
}
export function DashboardPeriodActivity({date,period,sectionName,refreshKey}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');const query=new URLSearchParams({...periodQuery(date,period),...sectionName&&{sectionName}});apiRequest(`/api/dashboard/activity?${query}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])}).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});return()=>controller.abort();},[date,period,sectionName,revision,refreshKey]);
 return <section className="dash-period-activity" aria-label="Activity in selected period"><header><h2>Recorded activity · {periodLabel(date,period)}</h2><p>Current enrollment and mastery remain in the overview above. These counts follow the selected period{sectionName?` and ${sectionName}`:''}.</p></header>{error?<p role="alert">Activity unavailable: {error} <button className="dash-button" onClick={()=>setRevision(v=>v+1)}>Retry activity</button></p>:!data?<p role="status">Loading selected activity…</p>:<><div className="dash-period-metrics">{[['Learners with records',data.recordedLearners],['Completed assessments',data.assessments],['Cleared attempts',data.cleared],['Feedback responses',data.feedback],['Reviews & support actions',data.interventions]].map(([label,value])=><article key={label}><strong>{value}</strong><span>{label}</span></article>)}</div><p className="dash-caption">{data.failed} failed attempts · {data.incomplete} attempts without a finished result in this period. No records does not mean no learning occurred.</p></>}</section>;
}
