import express from "express";
import cors from "cors";
import path from "path";
import { UPLOAD_DIR, SLIDES_DIR } from "./utils/storage.js";

import processRouter from "./routes/process.routes.js";
import slideRoutes from "./routes/slide.route.js";
import flashcardRoutes from "./routes/flashcard.route.js";
import upscaleRoutes from "./routes/upscale.routes.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

const projectRoot = path.resolve();

// ----------------------------------------------------------------------
// STATIC FILES
// ----------------------------------------------------------------------

// 1) Uploaded videos and frames from Multer + FFmpeg
// Directory: src/uploads
app.use(
  "/uploads",
  express.static(UPLOAD_DIR)
);

// 2) AI-generated slide PDFs
// Directory: src/uploads/slides
app.use(
  "/slides",
  express.static(SLIDES_DIR)
);

// DO NOT SERVE PROJECT ROOT (security risk)
// ❌ app.use("/", express.static(path.join(projectRoot)));

// ----------------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------------
app.use("/api/slides", slideRoutes);
app.use("/api/process", processRouter);

app.use("/api/flashcards", flashcardRoutes);
app.use("/api/upscale", upscaleRoutes);

// Health endpoint
app.get("/health", (req, res) =>
  res.json({ ok: true, now: new Date().toISOString() })
);

export default app;
