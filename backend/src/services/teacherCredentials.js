import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
import {fail} from './access.js';

// Domain-separated encryption key; never shared with browser clients.
function key(){return createHmac('sha256',process.env.JWT_SECRET).update('LEVELBLUE/teacher-temporary-password/v1').digest();}
export function encryptTemporaryPassword(id,passwordHash,password){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(),iv);
 cipher.setAAD(Buffer.from(JSON.stringify([String(id),passwordHash])));
 const encrypted=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');
}
export function decryptTemporaryPassword(id,passwordHash,encrypted){
 const [version,iv,tag,value]=encrypted.split('.');
 if(version!=='v1')throw new Error('Unsupported credential version');
 const cipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(iv,'base64url'));
 cipher.setAAD(Buffer.from(JSON.stringify([String(id),passwordHash])));
 cipher.setAuthTag(Buffer.from(tag,'base64url'));
 return Buffer.concat([cipher.update(Buffer.from(value,'base64url')),cipher.final()]).toString('utf8');
}
function checked({data,error}){
 if(error)throw fail(503,['42P01','42703','42883','PGRST202','PGRST205'].includes(error.code)?'Apply 20261015_teacher_password_preview.sql to enable temporary password previews.':'Temporary password preview is unavailable. Please retry.');
 return data;
}
export async function credentialStorageReady(db){checked(await db.from('teacher_temporary_credentials').select('user_id',{head:true}).limit(1));}
export async function storeTemporaryPassword(db,user,password){
 return checked(await db.rpc('levelblue_store_teacher_password',{p_user:String(user.id),p_password:user.password,p_ciphertext:encryptTemporaryPassword(user.id,user.password,password)}));
}
export async function previewTemporaryPassword(db,actor,id){
 if(actor.role!=='super'||actor.status!=='Active')throw fail(403,'School-head access required.');
 const stored=checked(await db.rpc('levelblue_preview_teacher_password',{p_actor:String(actor.id),p_user:String(id)}));
 if(!stored)return {available:false,message:'No temporary password is available. It is cleared after email verification; passwords created before this feature cannot be recovered.'};
 try{return {available:true,password:decryptTemporaryPassword(id,stored.passwordHash,stored.ciphertext)};}
 catch{throw fail(503,'This temporary password cannot be decrypted. Check that the backend encryption secret has not changed.');}
}
