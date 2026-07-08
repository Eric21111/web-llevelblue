import { supabase } from "../config/db.js";

// Helper: generate a random 4-digit clearance code
const generateClearanceCode = () => Math.floor(1000 + Math.random() * 9000).toString();

export const createBounty = async (req, res) => {
  try {
    const { mentor_id, mentee_id, topics } = req.body;
    if (!mentor_id || !mentee_id || !topics || topics.length === 0) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const topic = topics[0];
    const { data, error } = await supabase
      .from("support_bounties")
      .insert({ mentor_id, mentee_id, topic, status: "PENDING" })
      .select().single();
    if (error) {
      if (error.code === "42P01") return res.status(500).json({ error: "Table support_bounties does not exist." });
      throw error;
    }
    res.status(201).json(data);
  } catch (error) {
    console.error("Create bounty error:", error);
    res.status(500).json({ error: "Server error creating bounty" });
  }
};

export const getStudentBounties = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("support_bounties")
      .select(`*, mentee:mentee_id (name, section), mentor:mentor_id (name, section)`)
      .or(`mentor_id.eq.${id},mentee_id.eq.${id}`)
      .order("created_at", { ascending: false });
    if (error) {
      if (error.code === "42P01") return res.json([]);
      throw error;
    }
    res.json(data);
  } catch (error) {
    console.error("Fetch bounties error:", error);
    res.status(500).json({ error: "Server error fetching bounties" });
  }
};

// MECHANIC 1a: Mentor accepts → generates OTP, sets AWAITING_LINK
export const acceptBounty = async (req, res) => {
  try {
    const { id } = req.params;
    const clearanceCode = generateClearanceCode();
    const { data, error } = await supabase
      .from("support_bounties")
      .update({ status: "AWAITING_LINK", clearance_code: clearanceCode, otp_verified: false })
      .eq("id", id)
      .select().single();
    if (error) throw error;
    // Return data WITHOUT the code — mentor must get it from mentee
    const { clearance_code: _, ...safeData } = data;
    res.json(safeData);
  } catch (error) {
    console.error("Accept bounty error:", error);
    res.status(500).json({ error: "Server error accepting bounty" });
  }
};

// MECHANIC 1b: Mentor submits OTP → validate and set ACCEPTED
export const verifyOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Clearance code is required" });

    const { data: bounty, error: fetchErr } = await supabase
      .from("support_bounties").select("*").eq("id", id).single();
    if (fetchErr || !bounty) return res.status(404).json({ error: "Bounty not found" });

    if (bounty.clearance_code !== code.trim()) {
      return res.status(400).json({ error: "Invalid clearance code. Contact the mentee." });
    }

    const { data, error } = await supabase
      .from("support_bounties")
      .update({ status: "ACCEPTED", otp_verified: true })
      .eq("id", id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ error: "Server error verifying OTP" });
  }
};

// MECHANIC 1c: Mentee fetches their clearance code (shown on their screen)
export const getMenteeCode = async (req, res) => {
  try {
    const { bountyId } = req.params;
    const { data, error } = await supabase
      .from("support_bounties")
      .select("id, clearance_code, status, mentor:mentor_id (name), topic")
      .eq("id", bountyId).single();
    if (error || !data) return res.status(404).json({ error: "Bounty not found" });
    if (data.status !== "AWAITING_LINK") {
      return res.status(400).json({ error: "No active clearance code for this bounty" });
    }
    res.json({ clearance_code: data.clearance_code, mentor_name: data.mentor?.name, topic: data.topic });
  } catch (error) {
    console.error("Get mentee code error:", error);
    res.status(500).json({ error: "Server error fetching clearance code" });
  }
};

// MECHANIC 3a: Mentee confirms mentor helped → VALIDATED
export const validateBounty = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("support_bounties")
      .update({ status: "VALIDATED", mentee_confirmed: true })
      .eq("id", id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Validate bounty error:", error);
    res.status(500).json({ error: "Server error validating bounty" });
  }
};

// MECHANIC 3b: Mentee denies mentor helped → SELF_CLEARED
export const selfClearBounty = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from("support_bounties")
      .update({ status: "SELF_CLEARED", mentee_confirmed: false })
      .eq("id", id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Self-clear bounty error:", error);
    res.status(500).json({ error: "Server error self-clearing bounty" });
  }
};

// GET /api/bounties — get all active/pending bounties
export const getAllBounties = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("support_bounties")
      .select(`*, mentee:mentee_id (name, section), mentor:mentor_id (name, section)`);
    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Fetch all bounties error:", error);
    res.status(500).json({ error: "Server error fetching all bounties" });
  }
};

// DELETE /api/bounties/:id — cancel/delete a bounty
export const deleteBounty = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from("support_bounties")
      .delete()
      .eq("id", id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error("Delete bounty error:", error);
    res.status(500).json({ error: "Server error deleting bounty" });
  }
};


