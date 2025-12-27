import express from "express";
import cors from "cors";
import path from "path";
import { UPLOAD_DIR, SLIDES_DIR } from "./utils/storage.js";

import processRouter from "./routes/process.routes.js";
import slideRoutes from "./routes/slide.route.js";
import flashcardRoutes from "./routes/flashcard.route.js";
import upscaleRoutes from "./routes/upscale.routes.js";

const app = express();

// ----------------------------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------------------------
// ROOT ROUTE (IMPORTANT FOR VERCEL)
// ----------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    status: "Backend running on Vercel 🚀",
    endpoints: [
      "/health",
      "/api/process",
      "/api/slides",
      "/api/flashcards",
      "/api/upscale"
    ]
  });
});

// ----------------------------------------------------------------------
// STATIC FILES
// ----------------------------------------------------------------------

// Uploaded videos / frames
app.use("/uploads", express.static(UPLOAD_DIR));

// AI-generated slide PDFs
app.use("/slides", express.static(SLIDES_DIR));

// ----------------------------------------------------------------------
// API ROUTES
// ----------------------------------------------------------------------
app.use("/api/slides", slideRoutes);
app.use("/api/process", processRouter);
app.use("/api/flashcards", flashcardRoutes);
app.use("/api/upscale", upscaleRoutes);

// ----------------------------------------------------------------------
// HEALTH CHECK
// ----------------------------------------------------------------------
app.get("/health", (req, res) => {
  res.json({ ok: true, now: new Date().toISOString() });
});

export default app;
