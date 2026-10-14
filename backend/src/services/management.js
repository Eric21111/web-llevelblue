import {fail,result} from './access.js';
export function contactDetails(body){
 const {firstName,lastName,email,middleInitial=''}=body;
 if(![firstName,lastName].every(v=>typeof v==='string'&&v.trim()&&v.trim().length<=100)||typeof email!=='string'||email.trim().length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof middleInitial!=='string'||middleInitial.length>100)throw fail(400,'Valid first name, last name and email are required.');
 return {firstName:firstName.trim(),lastName:lastName.trim(),middleInitial:middleInitial.trim().slice(0,1),email:email.trim().toLowerCase()};
}
export async function managementResult(query){
 try{return await result(query);}catch(e){
  if(e.code==='23505')throw fail(409,'This email is already used by another account. Choose a different email.');
  if(['PGRST202','42883'].includes(e.code))throw fail(503,'Apply backend/migrations/20261014_management.sql to enable editing and safe section removal.');
  if(e.code==='P0001')throw fail(409,e.message);
  throw e;
 }
}
