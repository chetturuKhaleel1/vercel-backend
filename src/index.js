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
  // start job manager (in-process worker for MVP)
  jobManager.start();

  app.listen(PORT, () => {
    console.log(`🚀 Backend running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
