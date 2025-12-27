// server/src/services/frameExtractor.service.js
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

// Correct base folder → match all your other code
const FRAMES_ROOT = path.join(process.cwd(), "src", "uploads", "frames");

export const extractFrames = (videoPath, jobId, { fpsFallback = 0.5 } = {}) =>
  new Promise(async (resolve, reject) => {
    try {
      // Normalize path for FFmpeg
      const video = path.resolve(videoPath).replace(/\\/g, "/");

      // Create job root
      const jobRoot = path.join(FRAMES_ROOT, jobId);
      fs.mkdirSync(jobRoot, { recursive: true });

      console.log("🎬 Running SCENE DETECTION extractor...");

      // -------------------------------
      // 1️⃣ ROBUST FPS EXTRACTION (Simpler & More Reliable)
      // -------------------------------
      const fpsFolder = path.join(jobRoot, "fps");
      if (!fs.existsSync(fpsFolder)) fs.mkdirSync(fpsFolder, { recursive: true });

      const fpsPattern = path.join(fpsFolder, "frame-%04d.jpg");

      console.log(`🔨 FFmpeg Command: ffmpeg -i "${video}" -vf "fps=0.5,scale=1280:-1" "${fpsPattern}"`);

      await new Promise((res, rej) => {
        ffmpeg(video)
          .outputOptions([
            "-vf", "fps=0.5,scale=1280:-1", // Extract 1 frame every 2 seconds
            "-q:v", "2" // High quality JPEG
          ])
          .output(fpsPattern)
          .on("start", (cmd) => console.log("▶ FFmpeg Started:", cmd))
          .on("end", res)
          .on("error", (err, stdout, stderr) => {
            console.error("❌ FFmpeg Stderr:", stderr);
            rej(err);
          })
          .run();
      });

      const finalFrames = fs
        .readdirSync(fpsFolder)
        .filter((f) => f.endsWith(".jpg"))
        .map((f) => path.join(fpsFolder, f))
        .sort(); // Ensure order

      console.log(`✅ Extracted ${finalFrames.length} frames`);

      // -------------------------------
      // 2️⃣ Return Final Directory
      // -------------------------------
      // We just use the fps folder as the final folder to save time/space
      resolve(fpsFolder.replace(/\\/g, "/"));

    } catch (err) {
      console.error("❌ ExtractFrames Error:", err.message);
      reject(err);
    }
  });
