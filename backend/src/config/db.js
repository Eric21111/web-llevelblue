import mongoose from "mongoose";

const MONGO_URI = "mongodb+srv://levelblue122_db_user:y46sdm7MrNPNzwOr@cluster0.t2diook.mongodb.net/levelblue?appName=Cluster0";

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      family: 4,            // Force IPv4 — avoids IPv6 DNS lookup failures
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error("Tip: If you see ECONNREFUSED, check your internet connection or try switching to a different network / mobile hotspot.");
    process.exit(1);
  }
};
