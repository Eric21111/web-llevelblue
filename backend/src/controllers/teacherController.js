import { supabase } from "../config/db.js";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import {contactDetails,facultyProfile,managementResult} from "../services/management.js";
import { actorName } from "../utils/actor.js";
import { createTeacherInvites } from "../services/teacherInvites.js";
import { credentialStorageReady, storeTemporaryPassword } from "../services/teacherCredentials.js";
const teacherInvites = createTeacherInvites(supabase);

// Helper: map Supabase user row to frontend-expected shape
function mapUser(row) {
  return {
    _id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleInitial: row.middle_initial,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: row.role_label,
    sections: row.sections,
    students: row.students,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Helper: compute full name from parts
function computeName(firstName, middleInitial, lastName) {
  const mi = middleInitial ? ` ${middleInitial.toUpperCase().replace(/\./g, "")}.` : "";
  return `${firstName}${mi} ${lastName}`;
}

export const addTeacher = async (req, res) => {
  try {
    const { firstName, lastName, middleInitial, email } = contactDetails(req.body);
    const profile = facultyProfile(req.body);
    const tier=req.body.tier ?? 'teacher';
    if(!['teacher','subadmin'].includes(tier) || (tier==='subadmin' && req.user.role!=='super')) return res.status(403).json({error:'Only the Principal can appoint Head Admins.'});
    const sectionIds=req.body.sectionIds;
    if(!Array.isArray(sectionIds)||!sectionIds.length||sectionIds.some(id=>typeof id!=='string'||!id))return res.status(400).json({error:'Choose at least one assigned section.'});

    // Fail before creating an account if the required OTP schema is missing.
    await teacherInvites.ready();
    await credentialStorageReady(supabase);
    const generatedPassword = randomBytes(9).toString("base64url");
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    const name = computeName(firstName.trim(), middleInitial?.trim(), lastName.trim());

    const newTeacher=await managementResult(supabase.rpc('levelblue_invite_faculty',{p_actor:String(req.user.id),p_details:{firstName,lastName,middleInitial,email,name,tier,...profile},p_hash:hashedPassword,p_sections:sectionIds}));
    newTeacher.password=hashedPassword; // existing OTP binding and encrypted temporary credential

    let temporaryPasswordStored = false;
    try { temporaryPasswordStored = await storeTemporaryPassword(supabase, newTeacher, generatedPassword); }
    catch { /* Keep the creation response usable if credential storage is temporarily unavailable. */ }

    let invitationEmailSent = true;
    try { await teacherInvites.send(newTeacher); }
    catch { invitationEmailSent = false; }

    // Audit log
    await supabase.from("logs").insert({
      user: actorName(req, "Staff manager"),
      action: "Create staff account",
      details: `Created ${newTeacher.role_label} account for ${firstName} ${lastName} (${email})`,
    });

    res.setHeader('Cache-Control', 'no-store');
    res.status(201).json({ ...mapUser(newTeacher), generatedPassword, invitationEmailSent, temporaryPasswordStored });
  } catch (error) {
    if(!error.status||error.status>=500) console.error("Staff invitation failed:",error.code||error.status||"unknown");
    res.status(error.status || (error.code === "23505" ? 409 : 500)).json({ error: error.status ? error.message : error.code === "23505" ? "This email is already used by another staff account." : "Server error creating teacher account" });
  }
};
