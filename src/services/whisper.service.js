import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function runWhisper(videoPath) {
  try {
    console.log("🎤 Whisper starting...");

    // Normalize the video path
    const abs = path.resolve(videoPath);
    console.log("🎞 Absolute video path:", abs);

    if (!fs.existsSync(abs)) {
      console.log("❌ Video does NOT exist:", abs);
      return "";
    }

    // 🔥 COMPRESSED AUDIO OUTPUT (MUCH SMALLER)
    // Create a safe audio path in the same directory
    const videoDir = path.dirname(abs);
    const videoName = path.basename(abs, path.extname(abs));
    const audioPath = path.join(videoDir, `${videoName}_audio.mp3`);

    console.log("🎵 Exporting compressed audio:", audioPath);

    // Ensure output directory exists
    if (!fs.existsSync(videoDir)) {
      fs.mkdirSync(videoDir, { recursive: true });
    }

    // 🔊 Extract audio in MP3 (small size, Groq allows)
    await new Promise((resolve, reject) => {
      ffmpeg(abs)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate("64k")
        .audioFrequency(16000)
        .format("mp3")
        .on("start", (cmd) => console.log("▶ FFmpeg Audio Extract:", cmd))
        .on("error", (err, stdout, stderr) => {
          console.error("❌ FFmpeg Audio Error:", err.message);
          console.error("FFmpeg stderr:", stderr);
          reject(err);
        })
        .on("end", () => {
          console.log("✅ Audio extraction complete");
          resolve();
        })
        .save(audioPath);
    });

    console.log("🎧 Audio ready. Uploading to Groq…");

    const stream = fs.createReadStream(audioPath);

    const result = await groq.audio.transcriptions.create({
      file: stream,
      model: "whisper-large-v3", // 🔥 BEST MODEL - Most accurate
      response_format: "verbose_json", // Detailed JSON with timestamps
      timestamp_granularities: ["word"], // 🎯 WORD-LEVEL precision
      temperature: 0, // Deterministic (no randomness)
    });

    console.log("✅ Whisper transcription complete");
    console.log(`📊 Words extracted: ${result.words?.length || 0}`);

    // Return both text and word-level data
    return {
      text: result.text || "",
      words: result.words || [],
      segments: result.segments || []
    };
  } catch (err) {
    console.error("❌ Whisper Error:", err.message);
    return "";
  }
}
