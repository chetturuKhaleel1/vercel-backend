import dotenv from "dotenv";
dotenv.config();

import connectDB from "./utils/db.js";
import app from "./app.js";
import { ensureUploadDir } from "./utils/storage.js";

// run once per cold start
await connectDB();
ensureUploadDir();

// IMPORTANT: no listen, no workers
export default app;
