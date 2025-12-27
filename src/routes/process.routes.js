import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { startProcess, startProcessFromURL } from "../controllers/process.controller.js";
import { exportWithCaptions } from "../services/export.service.js";
import { v4 as uuidv4 } from 'uuid';

import { UPLOAD_DIR } from "../utils/storage.js";

const router = express.Router();

// Configure Multer for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // UPLOAD_DIR is already ensured by utils/storage.js
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Keep original extension
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.round(Math.random() * 1e9) + ext);
  },
});

const upload = multer({ storage });

// In-memory export job store
const exportJobs = {};

// ======================================================================
// 1) UPLOAD & PROCESS (Original Controller Logic)
// ======================================================================
router.post("/file", upload.single("video"), startProcess);
router.post("/url", startProcessFromURL);

// Legacy upload endpoint (redirect to /file for compatibility if needed)
router.post("/upload", upload.single("video"), startProcess);


// ======================================================================
// 2) JOB STATUS (Original Logic)
// ======================================================================
router.get("/status/:jobId", async (req, res) => {
  try {
    const { default: Job } = await import("../models/job.model.js");
    const job = await Job.findOne({ jobId: req.params.jobId }).lean();

    if (!job) return res.status(404).json({ error: "Job not found" });

    // Fix PDF path if needed
    if (job.slidesPdf && !job.slidesPdf.startsWith("/slides")) {
      job.slidesPdf = `/slides/${job.jobId}/${job.jobId}-notes.pdf`;
    }

    res.json({ job });
  } catch (err) {
    console.error("Status Error:", err);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});


// ======================================================================
// 3) EXPORT POLLING (New Logic)
// ======================================================================

// Start Export
router.post("/export/start", async (req, res) => {
  try {
    const { default: Job } = await import("../models/job.model.js");
    const { jobId, words, style, fontSize, yPos, textColor } = req.body;

    const job = await Job.findOne({ jobId }).lean();
    if (!job) return res.status(404).json({ error: "Job not found" });

    const exportId = uuidv4();
    // Create a unique output path
    const videoPath = path.resolve(job.filePath);
    const outputPath = videoPath.replace(/\.[^/.]+$/, `_export_${exportId}.mp4`);

    // Initialize export job
    exportJobs[exportId] = {
      id: exportId,
      status: "processing",
      progress: 0,
      outputPath: outputPath
    };

    // Start export in background
    exportWithCaptions(
      videoPath,
      { words, style, fontSize, yPos, textColor },
      outputPath,
      (progress) => {
        if (exportJobs[exportId]) {
          exportJobs[exportId].progress = progress;
        }
      }
    )
      .then(() => {
        if (exportJobs[exportId]) {
          exportJobs[exportId].status = "completed";
          exportJobs[exportId].progress = 100;
        }
      })
      .catch((err) => {
        console.error("Export failed:", err);
        if (exportJobs[exportId]) {
          exportJobs[exportId].status = "failed";
          exportJobs[exportId].error = err.message;
        }
      });

    res.json({ exportId, message: "Export started" });

  } catch (err) {
    console.error("Export start error:", err);
    res.status(500).json({ error: "Failed to start export" });
  }
});

// Check Export Status
router.get("/export/status/:exportId", (req, res) => {
  const job = exportJobs[req.params.exportId];
  if (!job) return res.status(404).json({ error: "Export job not found" });
  res.json(job);
});

// Download Exported File
router.get("/export/download/:exportId", (req, res) => {
  const job = exportJobs[req.params.exportId];
  if (!job || job.status !== "completed") {
    return res.status(404).json({ error: "File not ready or found" });
  }

  res.download(job.outputPath, (err) => {
    if (err) console.error("Download error:", err);
    // Optional: Clean up file after download if desired
    // fs.unlinkSync(job.outputPath); 
  });
});

export default router;
