import mongoose from "mongoose";

const MONGO_URI = "mongodb://levelblue122_db_user:48F0AxqKEECQNKxG@ac-9u3wmmo-shard-00-00.t2diook.mongodb.net:27017,ac-9u3wmmo-shard-00-01.t2diook.mongodb.net:27017,ac-9u3wmmo-shard-00-02.t2diook.mongodb.net:27017/?ssl=true&replicaSet=atlas-12ryng-shard-0&authSource=admin&appName=Cluster0";

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
