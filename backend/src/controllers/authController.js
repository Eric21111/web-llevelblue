import User from "../models/User.js";
import Log from "../models/Log.js";

// Login controller
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Write login audit log
    const log = new Log({
      user: user.name,
      action: "Logged in",
      details: `Role: ${user.roleLabel}`,
    });
    await log.save();

    // Remove password from response
    const userObj = user.toObject();
    delete userObj.password;

    res.json(userObj);
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
    const SIGNUP_SECURITY_KEY = "levelbluesecurity2026";
    if (securityKey !== SIGNUP_SECURITY_KEY) {
      return res.status(403).json({ error: "Invalid registration security key" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ error: "Account with this email already exists" });
    }

    const superAdmin = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      middleInitial: middleInitial ? middleInitial.trim() : "",
      email: email.toLowerCase().trim(),
      password,
      role: "super",
      roleLabel: "Department Head",
      status: "Active"
    });

    await superAdmin.save();

    // Log the registration
    const log = new Log({
      user: "System",
      action: "Super Admin Registered",
      details: `Created account for ${firstName} ${lastName} (${email})`,
    });
    await log.save();

    res.status(201).json({ message: "Super admin registered successfully" });
  } catch (error) {
    console.error("Super Admin registration error:", error);
    res.status(500).json({ error: "Server error during super admin registration" });
  }
};
