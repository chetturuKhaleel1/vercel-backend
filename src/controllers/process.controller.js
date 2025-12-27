import Job from "../models/job.model.js";
import crypto from "crypto";
import path from "path";
import jobManager from "../jobs/jobManager.js";
import { downloadYouTubeVideo } from "../services/youtube.service.js";

// ======================================================================
// 1) PROCESS VIDEO FILE (POST /process/file)
// ======================================================================

export const startProcess = async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Video file is required" });

    const jobId = crypto.randomUUID();

    // REAL ABSOLUTE PATH from multer
    const absolutePath = file.path.replace(/\\/g, "/");

    await Job.create({
      jobId,
      filePath: absolutePath,   // ✅ FIXED
      status: "queued",
      progress: 0,
    });

    jobManager.enqueueJob(jobId);

    return res.json({ success: true, jobId });

  } catch (err) {
    console.error("StartProcess Error:", err);
    return res.status(500).json({ error: err.message });
  }
};


// ======================================================================
// 2) PROCESS YOUTUBE URL (POST /process/url)
// ======================================================================

export const startProcessFromURL = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "YouTube URL is required" });

    const jobId = crypto.randomUUID();

    // Create DB job
    await Job.create({
      jobId,
      filePath: null,
      status: "downloading",
      progress: 0,
    });

    // Async download
    (async () => {
      try {
        // 🔥 ABSOLUTE FILE SYSTEM PATH
        const absolutePath = await downloadYouTubeVideo(url, jobId);

        console.log("🎥 Downloaded to:", absolutePath);

        await Job.updateOne(
          { jobId },
          {
            filePath: absolutePath,   // 🔥 STORE REAL PATH
            status: "queued",
            progress: 5,
          }
        );

        jobManager.enqueueJob(jobId);

      } catch (err) {
        console.error("YouTube Download Failed:", err);
        await Job.updateOne(
          { jobId },
          { status: "failed", error: err.message }
        );
      }
    })();

    return res.json({
      success: true,
      jobId,
      message: "YouTube download started...",
    });

  } catch (err) {
    console.error("startProcessFromURL Error:", err);
    return res.status(500).json({ error: err.message });
  }
};


