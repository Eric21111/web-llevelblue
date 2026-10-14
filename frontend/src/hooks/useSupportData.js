import {useEffect,useState} from 'react';
import {apiRequest} from '../utils/api';
export default function useSupportData(){
 const [data,setData]=useState({students:[],sections:[],notes:[]}),[errors,setErrors]=useState({}),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{const controller=new AbortController();setLoading(true);
  const sources={students:'/api/students',sections:'/api/sections',notes:'/api/interventions'};
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(20000)]);
  Promise.allSettled(Object.values(sources).map(url=>apiRequest(url,{signal}))).then(results=>{
   if(controller.signal.aborted)return;const next={},failures={};
   Object.keys(sources).forEach((key,i)=>{const result=results[i];if(result.status==='fulfilled'&&Array.isArray(result.value))next[key]=result.value;else{next[key]=[];failures[key]=result.reason?.message||'Unexpected server response.';}});
   setData(next);setErrors(failures);setLoading(false);
  });return()=>controller.abort();
 },[revision]);
 return {data,errors,loading,refresh:()=>setRevision(value=>value+1)};
}
