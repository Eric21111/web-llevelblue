import Log from "../models/Log.js";

export const getLogs = async (req, res) => {
  try {
    const logs = await Log.find({}).sort({ createdAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Server error fetching logs" });
  }
};

export const addLog = async (req, res) => {
  try {
    const { user, action, details } = req.body;
    if (!user || !action) {
      return res.status(400).json({ error: "User and action are required" });
    }

    const log = new Log({ user, action, details: details || "" });
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    console.error("Add log error:", error);
    res.status(500).json({ error: "Server error creating audit log entry" });
  }
};
