import {useEffect,useRef,useState} from 'react';
import {ChevronDown,Download,FileSpreadsheet,FileText,LoaderCircle} from 'lucide-react';
import {apiFetch} from '../../utils/api';

import {DashboardDatePicker,localDate,periodQuery,periodLabel} from './DashboardPeriod';
export default function DashboardExports({sectionName='',date,period,onDate,onPeriod}) {
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const root=useRef(null),trigger=useRef(null),first=useRef(null),request=useRef(null);
  useEffect(()=>{
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    const escape=e=>{if(e.key==='Escape'&&open){setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    if(open)first.current?.focus();
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  useEffect(()=>()=>request.current?.abort(),[]);
  async function download(format) {
    if(request.current)return;
    setError('');setMessage('');setOpen(false);trigger.current?.focus();
    const parameters=periodQuery(date,period);
    if(!date||date>localDate()){setError('Choose today or an earlier date.');return;}
    const controller=new AbortController();request.current=controller;setBusy(true);
    const timeout=setTimeout(()=>controller.abort('timeout'),60000);
    try {
      const query=new URLSearchParams({...parameters,format,...sectionName&&{sectionName}});
      const response=await apiFetch(`/api/dashboard/export?${query}`,{signal:controller.signal});
      if(!response.ok){let detail;try{detail=await response.json();}catch{/* Non-JSON server errors use the fallback. */}throw new Error(detail?.error||'Could not export the dashboard. Please retry.');}
      const blob=await response.blob();
      if(!blob.size||!blob.type.includes(format==='pdf'?'application/pdf':'text/csv'))throw new Error('The server returned an unexpected file. Please retry.');
      const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`LEVELBLUE-dashboard-${period==='year'?date.slice(0,4):period==='month'?date.slice(0,7):date}.${format}`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      setMessage(`${format.toUpperCase()} downloaded for ${periodLabel(date,period)}.`);
    }catch(e){if(controller.signal.reason!=='timeout'&&controller.signal.aborted)return;setError(controller.signal.aborted?'The export took too long. Please retry.':e.message);}
    finally{clearTimeout(timeout);request.current=null;if(!controller.signal.aborted||controller.signal.reason==='timeout')setBusy(false);}
  }
  return <div className="dash-export-controls" ref={root}>
    <div className="dash-heading-actions"><DashboardDatePicker date={date} period={period} onDate={v=>{onDate(v);setMessage('');setError('');}} onPeriod={v=>{onPeriod(v);setMessage('');setError('');}} disabled={busy}/>
      <div className="dash-export-anchor"><button ref={trigger} className="dash-primary-action" aria-expanded={open} aria-controls="dashboard-export-options" disabled={busy||!date} onClick={()=>setOpen(v=>!v)}>{busy?<LoaderCircle size={15} className="dash-spin"/>:<Download size={15}/>} {busy?'Exporting…':'Exports'}<ChevronDown size={13}/></button>
        {open&&<div id="dashboard-export-options" className="dash-export-options" role="group" aria-label="Download dashboard"><strong>Download dashboard</strong><small>{periodLabel(date,period)} · {sectionName||'All authorized sections'}</small><button ref={first} onClick={()=>download('csv')}><FileSpreadsheet size={17}/><span>CSV spreadsheet<small>Open in Excel or Sheets</small></span></button><button onClick={()=>download('pdf')}><FileText size={17}/><span>PDF for printing<small>A4 report with page numbers</small></span></button></div>}
      </div>
    </div>
    <p id="dashboard-export-basis" className="dash-export-note">Selected-period activity + current overview</p>
    {error&&<p className="dash-export-error" role="alert">{error}</p>}
    {message&&<p className="dash-export-status" role="status">{message}</p>}
  </div>;
}
