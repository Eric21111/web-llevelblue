import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { supabase } from "../config/db.js";

// Helper: compute full name from parts
function computeName(firstName, middleInitial, lastName) {
  const mi = middleInitial ? ` ${middleInitial.toUpperCase().replace(/\./g, "")}.` : "";
  return `${firstName}${mi} ${lastName}`;
}

// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Passwords security match (supports plain-text auto-migration)
    const isBcrypt = user.password && (user.password.startsWith("$2a$") || user.password.startsWith("$2b$"));
    let isMatch = false;

    if (isBcrypt) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = user.password === password;
      // Auto-migrate to bcrypt hash if plain-text password matches
      if (isMatch) {
        try {
          const hashedPassword = await bcrypt.hash(password, 10);
          await supabase
            .from("users")
            .update({ password: hashedPassword })
            .eq("id", user.id);
          console.log(`Auto-migrated password to bcrypt hash for user: ${email}`);
        } catch (migrationErr) {
          console.error("Failed to migrate plain text password:", migrationErr);
        }
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Sign JWT token with extended payload to avoid DB lookups in middleware
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        roleLabel: user.role_label,
        firstName: user.first_name,
        lastName: user.last_name,
        middleInitial: user.middle_initial,
        imageUrl: user.image_url,
        status: user.status
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Write login audit log
    await supabase.from("logs").insert({
      user: user.name,
      action: "Logged in",
      details: `Role: ${user.role_label}`,
    });

    // Remove password and map id → _id for frontend compatibility
    const { password: _, ...userObj } = user;
    userObj._id = userObj.id;
    userObj.roleLabel = userObj.role_label;
    userObj.firstName = userObj.first_name;
    userObj.lastName = userObj.last_name;
    userObj.middleInitial = userObj.middle_initial;
    userObj.createdAt = userObj.created_at;
    userObj.updatedAt = userObj.updated_at;

    res.json({ token, user: userObj });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
};

// Hidden Super Admin Signup controller
export const registerSuperAdmin = async (req, res) => {
  try {
    const { firstName, lastName, middleInitial, email, password, securityKey } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ error: "First name, last name, email, and password are required" });
    }

    // Optional verification key to protect signup
    const { data: settingData, error: settingError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "SIGNUP_SECURITY_KEY")
      .single();

    // Fallback to default if not set in DB
    const SIGNUP_SECURITY_KEY = (settingData && settingData.value) ? settingData.value : "levelbluesecurity2026";
    
    if (securityKey !== SIGNUP_SECURITY_KEY) {
      return res.status(403).json({ error: "Invalid registration security key" });
    }
    const { data: existingUser } = await supabase
      .from("users")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (existingUser) {
      return res.status(400).json({ error: "Account with this email already exists" });
    }

    const name = computeName(firstName.trim(), middleInitial?.trim(), lastName.trim());
    const hashedPassword = await bcrypt.hash(password, 10);

    const { error: insertError } = await supabase.from("users").insert({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      middle_initial: middleInitial ? middleInitial.trim() : "",
      name,
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: "super",
      role_label: "Department Head",
      status: "Active",
    });

    if (insertError) {
      console.error("Insert error:", insertError);
      return res.status(500).json({ error: "Server error during super admin registration" });
    }

    // Log the registration
    await supabase.from("logs").insert({
      user: "System",
      action: "Super Admin Registered",
      details: `Created account for ${firstName} ${lastName} (${email})`,
    });

    res.status(201).json({ message: "Super admin registered successfully" });
  } catch (error) {
    console.error("Super Admin registration error:", error);
    res.status(500).json({ error: "Server error during super admin registration" });
  }
};

// Update Profile controller
export const updateProfile = async (req, res) => {
  try {
    const { id, firstName, lastName, middleInitial, email, password, imageUrl } = req.body;
    if (!id || !email) {
      return res.status(400).json({ error: "User ID and Email are required" });
    }

    const name = computeName(firstName?.trim() || "", middleInitial?.trim(), lastName?.trim() || "");

    const updateData = {
      first_name: firstName?.trim(),
      last_name: lastName?.trim(),
      middle_initial: middleInitial?.trim(),
      name,
      email: email.toLowerCase().trim(),
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }
    
    if (imageUrl !== undefined) {
      updateData.image_url = imageUrl;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Update profile error:", updateError);
      return res.status(500).json({ error: "Server error during profile update" });
    }

    // Write audit log
    await supabase.from("logs").insert({
      user: updatedUser.name,
      action: "Profile Updated",
      details: "User updated their profile information",
    });

    const { password: _, ...userObj } = updatedUser;
    userObj._id = userObj.id;
    userObj.roleLabel = userObj.role_label;
    userObj.firstName = userObj.first_name;
    userObj.lastName = userObj.last_name;
    userObj.middleInitial = userObj.middle_initial;
    userObj.imageUrl = userObj.image_url;
    userObj.createdAt = userObj.created_at;
    userObj.updatedAt = userObj.updated_at;

    res.json(userObj);
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Server error during profile update" });
  }
};

// Complete Invite controller (force password change on first login)
export const completeInvite = async (req, res) => {
  try {
    const { id, password } = req.body;
    if (!id || !password) {
      return res.status(400).json({ error: "User ID and new password are required" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const { data: updatedUser, error: updateError } = await supabase
      .from("users")
      .update({ password: hashedPassword, status: "Active" })
      .eq("id", id)
      .eq("status", "Invited") // Ensure they are actually in Invited status
      .select("*")
      .single();

    if (updateError || !updatedUser) {
      console.error("Complete invite error:", updateError);
      return res.status(400).json({ error: "Failed to update password or user not found" });
    }

    // Write audit log
    await supabase.from("logs").insert({
      user: updatedUser.name,
      action: "Account Activated",
      details: "User completed first-login password change",
    });

    const { password: _, ...userObj } = updatedUser;
    userObj._id = userObj.id;
    userObj.roleLabel = userObj.role_label;
    userObj.firstName = userObj.first_name;
    userObj.lastName = userObj.last_name;
    userObj.middleInitial = userObj.middle_initial;
    userObj.imageUrl = userObj.image_url;
    userObj.createdAt = userObj.created_at;
    userObj.updatedAt = userObj.updated_at;

    res.json(userObj);
  } catch (error) {
    console.error("Complete invite error:", error);
    res.status(500).json({ error: "Server error during password update" });
  }
};

// Get current logged-in user profile (always fetch fresh from DB to sync UI state)
export const getMe = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", req.user.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "User not found" });
    }

    const userObj = {
      ...user,
      _id: user.id,
      roleLabel: user.role_label,
      firstName: user.first_name,
      lastName: user.last_name,
      middleInitial: user.middle_initial,
      imageUrl: user.image_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };
    
    // Remove password
    delete userObj.password;
    
    res.json(userObj);
  } catch (error) {
    console.error("GetMe error:", error);
    res.status(500).json({ error: "Server error restoring session" });
  }
};

// Helper: send verification code via Brevo SMTP API
async function sendBrevoEmail(toEmail, code) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "no-reply@levelblue.com";
  const senderName = process.env.BREVO_SENDER_NAME || "LevelBlue Security";

  if (!apiKey) {
    console.warn("BREVO_API_KEY is not defined in .env. Verification code (dev):", code);
    return false; // Returns false so the controller knows it ran in dev fallback mode
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "api-key": apiKey,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail }],
      subject: "Verify Your Email Address - LevelBlue",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 10px; background-color: #0F1729; color: #E7EBF3;">
          <h2 style="color: #3DD6C4; text-align: center;">LevelBlue Security Awareness</h2>
          <p>Hello,</p>
          <p>To verify your email address on the LevelBlue Console, please use the following 6-digit verification code:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-family: monospace; font-size: 32px; font-weight: bold; background-color: #172238; color: #E7EBF3; padding: 10px 20px; border-radius: 5px; letter-spacing: 5px; border: 1px solid #26334F;">
              ${code}
            </span>
          </div>
          <p>This code is valid for 10 minutes. If you did not request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #26334F; margin: 20px 0;" />
          <p style="font-size: 12px; color: #8C9BBF; text-align: center;">WMSU-ILS · LevelBlue Platform</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Failed to send email via Brevo");
  }

  return true;
}

// Controller: send email verification code
export const sendVerificationCode = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email address is required" });
    }

    // Generate a random 6-digit numeric code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Save/Upsert code to email_verifications table
    const { error: dbError } = await supabase
      .from("email_verifications")
      .upsert({ email: email.toLowerCase().trim(), code, created_at: new Date() }, { onConflict: "email" });

    if (dbError) {
      // If table doesn't exist yet, we will alert the user but mock send it
      if (dbError.code === "42P01" || (dbError.message && dbError.message.includes("does not exist"))) {
        console.warn("email_verifications table not found. Operating in local mock mode.");
      } else {
        throw dbError;
      }
    }

    // Send email using Brevo
    const emailSent = await sendBrevoEmail(email, code);

    res.json({
      message: "Verification code sent successfully",
      // Include the code in the response *only* if Brevo is not configured so the user can easily test in development
      code: !emailSent ? code : undefined, 
      devMode: !emailSent
    });
  } catch (error) {
    console.error("Send verification code error:", error);
    res.status(500).json({ error: "Server error sending verification code" });
  }
};

// Controller: verify email code
export const verifyCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: "Email and verification code are required" });
    }

    // Query email_verifications
    const { data: record, error: dbError } = await supabase
      .from("email_verifications")
      .select("*")
      .eq("email", email.toLowerCase().trim())
      .single();

    if (dbError) {
      // Graceful fallback for mock mode if table does not exist
      if (dbError.message.includes("does not exist") || dbError.code === "PGRST116") {
        // Just return true if they typed "123456" or any 6-digit code in mock mode
        if (code.length === 6) {
          return res.json({ verified: true, mock: true });
        }
        return res.status(400).json({ error: "Invalid verification code" });
      }
      throw dbError;
    }

    if (!record || record.code !== code) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    // Check expiration (10 minutes)
    const recordTime = new Date(record.created_at).getTime();
    const currentTime = new Date().getTime();
    const diffMinutes = (currentTime - recordTime) / (1000 * 60);

    if (diffMinutes > 10) {
      return res.status(400).json({ error: "Verification code has expired" });
    }

    // Success: Delete the code record from DB
    await supabase.from("email_verifications").delete().eq("email", email.toLowerCase().trim());

    res.json({ verified: true });
  } catch (error) {
    console.error("Verify code error:", error);
    res.status(500).json({ error: "Server error verifying code" });
  }
};
