import {fail} from './access.js';
import {TOPICS} from './learning.js';
export const CONTENT_KINDS=['lesson','quiz','codex'];
function text(value,label,max,required=false){
 if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw fail(400,`${label} must be ${required?'nonempty ':''}text of at most ${max} characters.`);
 return value.trim();
}
function list(value,label,maxItems=10){
 if(!Array.isArray(value)||value.length>maxItems)throw fail(400,`${label} must contain at most ${maxItems} entries.`);
 return value.map(v=>text(v,label,1000));
}
export function validateContent(input,complete=false){
 if(!input||typeof input!=='object'||!CONTENT_KINDS.includes(input.kind)||!TOPICS.includes(input.topic))throw fail(400,'Choose a lesson, quiz item or Threat Codex entry and a supported topic.');
 const title=text(input.title,'Title',180,true),c=input.content;
 if(!c||typeof c!=='object'||Array.isArray(c))throw fail(400,'Content must be an object.');
 let content;
 if(input.kind==='lesson'){
  content={body:text(c.body,'Lesson',20000,complete),objectives:list(c.objectives,'Learning objectives').filter(Boolean)};
 }else if(input.kind==='codex'){
  content={definition:text(c.definition,'Definition',10000,complete),warningSigns:list(c.warningSigns,'Warning signs').filter(Boolean),safeResponse:text(c.safeResponse,'Safe response',10000,complete)};
 }else{
  const options=list(c.options,'Answer choices',6);
  if(options.length<2)throw fail(400,'Provide between two and six answer choices.');
  if(c.correctOption!==null&&(!Number.isInteger(c.correctOption)||c.correctOption<0||c.correctOption>=options.length))throw fail(400,'Choose a valid correct answer.');
  if(complete&&(options.some(v=>!v)||new Set(options.map(v=>v.toLowerCase())).size!==options.length||c.correctOption===null))throw fail(400,'Provide distinct, nonempty answer choices and select the correct answer.');
  content={prompt:text(c.prompt,'Question',5000,complete),options,correctOption:c.correctOption,explanation:text(c.explanation,'Answer explanation',10000,complete)};
 }
 return {kind:input.kind,topic:input.topic,title,content};
}
export function publishedCatalog(revisions){
 const latest=new Map();
 for(const r of revisions.filter(r=>r.status==='published'))if(!latest.has(r.item_id)||r.revision>latest.get(r.item_id).revision)latest.set(r.item_id,r);
 return {schemaVersion:1,releaseVersion:revisions.reduce((v,r)=>r.status==='published'?Math.max(v,Number(r.release_version)||0):v,0),items:[...latest.values()].sort((a,b)=>a.item_id.localeCompare(b.item_id)).map(r=>({id:r.item_id,revision:r.revision,releaseVersion:Number(r.release_version),kind:r.kind,topic:r.topic,title:r.title,content:r.content,publishedAt:r.published_at}))};
}
