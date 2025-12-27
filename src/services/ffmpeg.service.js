import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";

function abs(p) {
  return path.resolve(p).replace(/\\/g, "/");
}

export async function extractFrames(videoPath, jobId) {
  const folder = abs(path.join("server/src/uploads", `${jobId}-frames`));
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const inputVideo = abs(videoPath);
  const outputPattern = `${folder}/frame-%03d.jpg`;

  console.log("🎞 Extracting frames from:", inputVideo);

  return new Promise((resolve, reject) => {
    ffmpeg(inputVideo)
      .on("start", cmd => console.log("🎬 FFmpeg:", cmd))
      .on("error", err => {
        console.error("❌ Scene detection failed:", err.message);
        console.log("⚠ Falling back to FPS extractor...");

        // FALLBACK: FPS extraction
        return fallbackFPS(inputVideo, folder, resolve, reject);
      })
      .on("end", () => {
        let frames = fs.readdirSync(folder)
          .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
          .map(f => path.join(folder, f))
          .sort();

        // Fallback if scene detect produced 0–1 frames
        if (frames.length < 2) {
          console.log("⚠ Too few scene frames. Running FPS fallback...");
          return fallbackFPS(inputVideo, folder, resolve, reject);
        }

        console.log("✅ Extracted scene frames:", frames.length);
        resolve(frames);
      })
      .outputOptions([
        "-vf", "select='gt(scene,0.3)',scale=1280:-1",
        "-vsync", "vfr"
      ])
      .save(outputPattern);
  });
}

// ⭐ FALLBACK — Regular FPS extraction
function fallbackFPS(video, folder, resolve, reject) {
  const outputPattern = `${folder}/frame-%03d.jpg`;

  ffmpeg(video)
    .on("end", () => {
      const frames = fs.readdirSync(folder)
        .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
        .map(f => path.join(folder, f))
        .sort();

      if (frames.length === 0) {
        console.error("❌ No frames extracted at all!");
        return reject(new Error("No frames extracted."));
      }

      console.log("✅ Fallback FPS frames:", frames.length);
      resolve(frames);
    })
    .on("error", err => {
      console.error("❌ FPS fallback failed:", err.message);
      reject(err);
    })
    .outputOptions([
      "-vf", "fps=1,scale=1280:-1"
    ])
    .save(outputPattern);
}
