import { exec } from "child_process";
import path from "path";
import fs from "fs";

export function downloadYouTubeVideo(url, jobId) {
  return new Promise((resolve, reject) => {
    const uploadsDir = path.join(process.cwd(), "server", "src", "uploads");

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const outputFile = path.join(uploadsDir, `${jobId}.mp4`);
    const ytDlpPath = path.resolve("bin/yt-dlp.exe");

    // ⭐ FIXED — Best format + fallback + remux to MP4
    const command = `"${ytDlpPath}" `
      + `-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best" `
      + `--merge-output-format mp4 `
      + `-o "${outputFile}" `
      + `"${url}"`;

    console.log("▶ Running:", command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("❌ yt-dlp error:", stderr || error.message);
        reject(new Error("Failed to download YouTube video"));
        return;
      }

      console.log("🎥 Download complete:", outputFile);
      resolve(outputFile.replace(/\\/g, "/"));
    });
  });
}
