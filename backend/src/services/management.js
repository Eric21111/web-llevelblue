import {fail,result} from './access.js';
export function contactDetails(body){
 const {firstName,lastName,email,middleInitial=''}=body;
 if(![firstName,lastName].every(v=>typeof v==='string'&&v.trim()&&v.trim().length<=100)||typeof email!=='string'||email.trim().length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())||typeof middleInitial!=='string'||middleInitial.length>100)throw fail(400,'Valid first name, last name and email are required.');
 return {firstName:firstName.trim(),lastName:lastName.trim(),middleInitial:middleInitial.trim().slice(0,1),email:email.trim().toLowerCase()};
}
export function facultyProfile(body){
 const birthday=body.birthday,phone=typeof body.contactNumber==='string'?body.contactNumber.trim().replace(/[ ()-]/g,''):'';
 const date=typeof birthday==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(birthday)?new Date(birthday+'T00:00:00Z'):null;
 if(!date||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==birthday||birthday<'1900-01-01'||birthday>new Date().toISOString().slice(0,10))throw fail(400,'Enter a valid birthday in the past or today.');
 if(!/^\+?\d{7,15}$/.test(phone))throw fail(400,'Enter a contact number containing 7–15 digits, optionally starting with +.');
 return {birthday,contactNumber:phone};
}
export async function managementResult(query){
 try{return await result(query);}catch(e){
  if(e.code==='42501')throw fail(403,'This action is outside your permissions.');
  if(e.code==='23505'&&e.message?.includes('This name'))throw fail(409,'That full name already belongs to another account.');
  if(e.code==='23505')throw fail(409,'This email is already used by another account. Choose a different email.');
  if(['PGRST202','42883'].includes(e.code))throw fail(503,'Apply the management migrations (20261014_management.sql and 20261106_staff_provisioning.sql) before continuing.');
  if(e.code==='P0001')throw fail(409,e.message);
  throw e;
 }
}
