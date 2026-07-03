import jwt from "jsonwebtoken";
import { supabase } from "../config/db.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];
    let decoded;
    
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    // Optimization: If the token contains the extended payload, skip the DB lookup
    if (decoded.email && decoded.status) {
      req.user = decoded;
      return next();
    }

    // Fetch user details from DB to verify existence and append metadata (fallback for old tokens)
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: "User no longer exists." });
    }

    // Map DB columns for auth context
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      roleLabel: user.role_label,
      firstName: user.first_name,
      lastName: user.last_name,
      middleInitial: user.middle_initial,
      imageUrl: user.image_url,
      status: user.status
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
};
