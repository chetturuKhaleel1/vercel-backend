import mongoose from "mongoose";

export default async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not defined in .env");

  mongoose.set("strictQuery", false);
  await mongoose.connect(uri);
  console.log("✅ MongoDB connected");
}
