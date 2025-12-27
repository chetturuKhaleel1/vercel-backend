import dotenv from "dotenv";
dotenv.config();

import connectDB from "./utils/db.js";
import app from "./app.js";
import jobManager from "./jobs/jobManager.js";
import { ensureUploadDir } from "./utils/storage.js";

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  ensureUploadDir();
  jobManager.start(); // local only

  app.listen(PORT, () => {
    console.log(`🚀 Local backend running on ${PORT}`);
  });
}

start();
