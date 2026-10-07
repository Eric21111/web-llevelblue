export function fakeDb(seed) {
 const tables=structuredClone(seed),writes=[];
 return {tables,writes,from(table){
   let filters=[],payload,operation='select',single=false,range=null;
   const q={select(){return q;},eq(k,v){filters.push(r=>String(r[k])===String(v));return q;},in(k,v){filters.push(r=>v.map(String).includes(String(r[k])));return q;},is(k,v){filters.push(r=>(r[k]??null)===v);return q;},order(){return q;},range(a,b){range=[a,b];return q;},maybeSingle(){single=true;return q;},single(){single=true;return q;},insert(v){operation='insert';payload=v;return q;},update(v){operation='update';payload=v;return q;},then(resolve,reject){
    try{
     if(!tables[table])return Promise.resolve({data:null,error:{code:'42P01'}}).then(resolve,reject);
     let rows=tables[table].filter(r=>filters.every(f=>f(r)));
     if(operation==='insert'){rows=(Array.isArray(payload)?payload:[payload]).map((v,i)=>({id:`new-${writes.length}-${i}`,created_at:'2026-10-07T00:00:00Z',...v}));tables[table].push(...rows);writes.push({table,payload});}
     if(operation==='update'){rows.forEach(r=>Object.assign(r,payload));writes.push({table,payload});}
     if(range)rows=rows.slice(range[0],range[1]+1);
     return Promise.resolve({data:single?rows[0]||null:rows,error:null}).then(resolve,reject);
    }catch(e){return Promise.reject(e).then(resolve,reject);}
   }};return q;
 }};
}
export const seed={sections:[{id:'a',scope_id:'a',name:'Emerald',grade_level:'Grade 11'},{id:'b',scope_id:'b',name:'Sapphire',grade_level:'Grade 12'}],teacher_sections:[{teacher_id:'teacher',section_id:'a'},{teacher_id:'co-teacher',section_id:'a'},{teacher_id:'other',section_id:'b'}],
 students:[{id:'s1',name:'Learner One',section:'Emerald',section_id:'a',grade_level:'Grade 11',pre:0,post:8,pre_completed_at:'2026-01-01',post_completed_at:'2026-02-01',pre_scale:'quiz-v1-10',post_scale:'quiz-v1-10',pre_assessment_pair_id:'pair-1',post_assessment_pair_id:'pair-1'},{id:'s2',name:'Learner Two',section:'Sapphire',section_id:'b',grade_level:'Grade 12'},{id:'mentor',name:'Mentor',section:'Emerald',section_id:'a',grade_level:'Grade 11'}],
 bkt_records:[{student_id:'s1',topic:'Phishing',probability_known:0},{student_id:'s2',topic:'Phishing',probability_known:.2},{student_id:'mentor',topic:'Phishing',probability_known:.95}],
 learning_interventions:[],feedback:[],support_bounties:[],users:[{id:'teacher',role:'admin',status:'Active'}]};
