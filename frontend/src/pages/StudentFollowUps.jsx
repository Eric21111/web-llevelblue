import {RefreshButton} from '../components/WorkspaceUI';
import {useState} from 'react';
import {ClipboardCheck} from 'lucide-react';
import useSupportData from '../hooks/useSupportData';
import {SupportFilters,SupportPagination,useSupportPage} from '../components/SupportUI';
import {SKILLS,studentId} from '../utils/dashboard';
import {formatLastActive} from '../utils/time';
import {ACTION_LABELS,filterLearners,latestActions,recordedTopics,supportTopics,reviewPath} from '../utils/support';
import '../styles/support.css';

export default function StudentFollowUps({onNavigate}){
 const {data,errors,loading,refresh}=useSupportData();
 const [section,setSection]=useState(''),[grade,setGrade]=useState(''),[query,setQuery]=useState(''),[topic,setTopic]=useState(''),[need,setNeed]=useState('support');
 const initialName=new URLSearchParams(window.location.search).get('section');
 const scopedSection=section||(!grade&&initialName?data.sections.find(s=>s.name===initialName)?.id||'':'');
 const [useInitial,setUseInitial]=useState(true);
 const selectedSection=useInitial?scopedSection:section;
 const base=filterLearners(data.students,{section:selectedSection,grade,query});
 const filtered=filterLearners(base,{need,topic});
 const latest=latestActions(data.notes),pagination=useSupportPage(filtered,`${selectedSection}|${grade}|${query}|${topic}|${need}`);
 return <div className="dashboard support-workspace">
  <header className="support-page-heading"><div><h1>Student Follow-ups</h1><p>Who needs practice, and the next step.</p></div><button className="dash-button" onClick={()=>onNavigate('/interventions')}><ClipboardCheck size={16}/>Reviews & remediation</button></header>
  <div className="support-guide"><strong>Start here</strong><span>Choose a student below. “Review student” opens their learning context and lets you record a review or schedule classroom support.</span></div>
  <section className="support-panel">
   <SupportFilters sections={data.sections} grade={grade} setGrade={v=>{setGrade(v);setUseInitial(false);}} section={selectedSection} setSection={v=>{setSection(v);setUseInitial(false);}} query={query} setQuery={setQuery}/>
   <div className="support-summary" aria-label="Filter by learning need">{[['support','Need topic support',base.filter(s=>supportTopics(s).length).length,'At least one recorded topic below 40%'],['unassessed','No mastery recorded',base.filter(s=>!recordedTopics(s).length).length,'Check access or encourage a first activity'],['all','All learners',base.length,'Review any student in this selection']].map(([key,label,count,description])=><button key={key} aria-pressed={need===key} onClick={()=>{setNeed(key);setTopic('');}}><span>{label}</span><strong>{loading||errors.students?'—':count}</strong><small>{description}</small></button>)}</div>
  </section>
  <section className="support-panel"><div className="support-section-heading"><div><h2>{need==='support'?'Students needing topic support':need==='unassessed'?'Students without recorded mastery':'Students in your selection'}</h2><p>Mastery estimates guide support; they are not exam grades.</p></div><RefreshButton loading={loading} onClick={refresh}/></div>
   {need==='support'&&<label className="support-topic-filter">Topic<select value={topic} onChange={e=>setTopic(e.target.value)}><option value="">All topics</option>{SKILLS.map(t=><option key={t}>{t}</option>)}</select></label>}
   {Object.keys(errors).length>0&&<p className="support-error" role="alert">{errors.students?'Student records could not be loaded.':errors.sections?'Section filters could not be loaded.':'Review history could not be loaded. Latest actions are unavailable.'} Use Refresh to try again.</p>}
   {loading?<p className="support-empty" role="status">Loading student follow-ups…</p>:errors.students?null:!filtered.length?<div className="support-empty"><h3>No students in this view</h3><p>{need==='support'?'No recorded topic falls below 40% for these filters. Unassessed students appear in “No mastery recorded”.':'Try another section, grade, or search.'}</p></div>:<div className="support-table-scroll" tabIndex={0} aria-label="Scrollable student follow-ups"><table className="support-table"><thead><tr><th>Student</th><th>Learning need</th><th>Latest recorded action</th><th>Next step</th></tr></thead><tbody>{pagination.items.map(s=>{const topics=supportTopics(s),action=latest.get(studentId(s));return <tr key={studentId(s)}><th>{s.name}<small>{s.section||'Unassigned'} · {s.gradeLevel||'Grade unconfirmed'}</small><small>Active: {formatLastActive(s.lastActive)}</small></th><td>{topics.length?<div className="support-tags">{topics.map(t=><span key={t}>{t} <b>{Math.round(s.mastery[t]*100)}%</b></span>)}</div>:<span>{recordedTopics(s).length?'No recorded topic below 40%':'No mastery recorded yet'}</span>}<small>{recordedTopics(s).length} of 5 topics assessed</small></td><td>{errors.notes?'Unavailable':action?<><span>{ACTION_LABELS[action.kind]||'Review'} · {action.outcome}</span><small>{new Date(action.created_at).toLocaleDateString()}</small></>:'No action recorded'}</td><td><button className="dash-primary-action" onClick={()=>onNavigate(reviewPath(s))}>Review student</button></td></tr>;})}</tbody></table></div>}
   {!loading&&!errors.students&&<SupportPagination state={pagination}/>}
  </section>
 </div>;
}
