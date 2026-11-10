import WorkspaceSelect from '../WorkspaceSelect';
import {useEffect,useRef,useState} from 'react';
import {CalendarDays,CalendarClock,ChevronLeft,ChevronRight,X} from 'lucide-react';
import {useWorkspaceQuery} from '../../hooks/useWorkspaceQuery';
import Skeleton from '../Skeleton';

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
 {period==='day'?<label><span className="dash-sr-only">Calendar month</span><WorkspaceSelect value={month} onChange={e=>setView(new Date(year,Number(e.target.value),1))}>{months.map((m,i)=><option key={m} value={i}>{m}</option>)}</WorkspaceSelect></label>:null}
 {period!=='year'?<label><span className="dash-sr-only">Calendar year</span><WorkspaceSelect value={year} onChange={e=>setView(new Date(Number(e.target.value),month,1))}>{Array.from({length:new Date().getFullYear()-1899},(_,i)=>new Date().getFullYear()-i).map(y=><option key={y}>{y}</option>)}</WorkspaceSelect></label>:<strong>{decade}–{decade+11}</strong>}
 <button className="dash-button" aria-label={`Next ${period==='day'?'month':period==='month'?'year':'years'}`} disabled={period==='day'?new Date(year,month+1,1)>new Date():period==='month'?year>=new Date().getFullYear():decade+12>new Date().getFullYear()} onClick={()=>period==='day'?moveMonth(1):setView(new Date(year+(period==='year'?12:1),month,1))}><ChevronRight size={16}/></button></div>
 {period==='day'?<><div className="dash-calendar-week" aria-hidden="true">{['Su','Mo','Tu','We','Th','Fr','Sa'].map(d=><span key={d}>{d}</span>)}</div><div className="dash-calendar-grid">{Array.from({length:firstDay},(_,i)=><span key={`empty${i}`}/>)}{Array.from({length:days},(_,i)=>{const d=new Date(year,month,i+1),key=localDate(d);return <button key={key} data-date={key} aria-label={d.toLocaleDateString(undefined,{dateStyle:'full'})} aria-pressed={date===key} aria-current={key===today?'date':undefined} disabled={key>today} tabIndex={key===focused||(!focused.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)&&i===0)?0:-1} onKeyDown={e=>keyDay(e,key)} onClick={()=>choose(d)}>{i+1}</button>;})}</div></>:<div className="dash-calendar-periods">{Array.from({length:12},(_,i)=>{const d=period==='month'?new Date(year,i,1):new Date(decade+i,0,1);return <button key={i} disabled={localDate(d)>today||d.getFullYear()<1900} aria-pressed={period==='month'?date.startsWith(localDate(d).slice(0,7)):date.startsWith(String(decade+i))} onClick={()=>choose(d)}>{period==='month'?months[i]:decade+i}</button>;})}</div>}
 <footer><button className="dash-button" onClick={()=>choose(new Date())}>{period==='day'?'Today':period==='month'?'This month':'This year'}</button><small>Future periods are unavailable.</small></footer></dialog>;
}
export function DashboardDatePicker({date,period,onDate,onPeriod,disabled}){
 const [open,setOpen]=useState(false);
 return <><div className="dash-period-toggle" role="group" aria-label="Activity period">{['day','month','year'].map(p=><button key={p} disabled={disabled} aria-pressed={period===p} onClick={()=>onPeriod(p)}>{p[0].toUpperCase()+p.slice(1)}</button>)}</div><button className="dash-date" disabled={disabled} aria-haspopup="dialog" onClick={()=>setOpen(true)}><CalendarDays size={15}/>{periodLabel(date,period)}</button>{open&&<CalendarDialog date={date} period={period} onSelect={onDate} onClose={()=>setOpen(false)}/>}</>;
}
export function DashboardPeriodActivity({date,period,sectionName}){
 const query=new URLSearchParams({...periodQuery(date,period),...sectionName&&{sectionName}});
 const {data:{activity},errors,refresh}=useWorkspaceQuery({activity:`/api/dashboard/activity?${query}`});
 const rows=activity?[['Learners with records',activity.recordedLearners],['Completed assessments',activity.assessments],['Cleared attempts',activity.cleared],['Feedback responses',activity.feedback],['Support actions',activity.interventions]]:[];
 const maximum=Math.max(1,...rows.map(([,count])=>count??0));
 const quiet=activity && [...rows.map(([,count])=>count),activity.failed,activity.incomplete].every(count=>count===0);
 if(quiet&&!errors.activity)return <section className="dash-quiet" aria-label="Recorded activity">
   <CalendarClock size={22} aria-hidden="true"/><div><h2>No activity recorded for this {period}</h2>
   <p>{periodLabel(date,period)}{sectionName&&` · ${sectionName}`}</p></div>
 </section>;
 return <section className="dash-period-activity"><header><h2>Recorded activity</h2><p>{periodLabel(date,period)}{sectionName&&` · ${sectionName}`}</p></header>
 {errors.activity?<p role="alert">{errors.activity} <button className="dash-button" onClick={refresh}>Try again</button></p>:!activity?<Skeleton label="Loading activity"/>:<>
 <dl className="dash-period-bars">{rows.map(([label,count])=><div key={label}><dt>{label}</dt><dd><span className="dash-chart-track" aria-hidden="true"><i style={{width:`${100*(count??0)/maximum}%`}}/></span><strong>{count??'—'}</strong></dd></div>)}</dl>
 <p className="dash-caption">{activity.failed} failed attempts · {activity.incomplete} unfinished attempts</p></>}</section>;
}
