import jwt from 'jsonwebtoken';
import { supabase } from '../config/db.js';
export function createAuthMiddleware(db, secret = () => process.env.JWT_SECRET) {
  return async (req,res,next) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if(!token) return res.status(401).json({error:'Access denied. No token provided.'});
    let decoded;
    try { decoded=jwt.verify(token,secret()); } catch { return res.status(401).json({error:'Invalid or expired token.'}); }
    try {
      const student=decoded.role==='student';
      const {data:user,error}=await db.from(student?'students':'users').select('*').eq('id',decoded.id).maybeSingle();
      if(error) return res.status(503).json({error:'Account verification is unavailable. Please retry.'});
      if(!user || (!student && (!['admin','super'].includes(user.role) || !['Active','Invited'].includes(user.status)))) return res.status(401).json({error:'Your account is inactive or no longer available.'});
      if(!student && decoded.role && decoded.role!==user.role) return res.status(401).json({error:'Please sign in again.'});
      req.user={id:user.id,role:student?'student':user.role,status:user.status,email:user.email,name:user.name,firstName:user.first_name,lastName:user.last_name,roleLabel:user.role_label};
      next();
    } catch { res.status(503).json({error:'Account verification is unavailable.'}); }
  };
}
export const authMiddleware=createAuthMiddleware(supabase);
