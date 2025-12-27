// server/src/services/video.service.js
import fs from "fs";
import path from "path";
import Job from "../models/job.model.js";

import { extractFrames } from "./frameExtractor.service.js";
import { runWhisper } from "./whisper.service.js";
import { groqText } from "../utils/groq.js";
import { buildCleanSlidesPDF } from "./slideBuilder.service.js";
import { classifyFrames } from "./frameClassifier.service.js";

const projectRoot = process.cwd();

export async function runJob(jobId) {
  const job = await Job.findOne({ jobId });
  if (!job) throw new Error("Job record not found");

  await Job.updateOne({ jobId }, { status: "processing", progress: 5 });

  // ----------------------------------------------------
  // 1) FIX VIDEO PATH
  // ----------------------------------------------------
  let videoFsPath = job.filePath;
  console.log(`🔍 Debug Path Resolution: CWD=${process.cwd()} | Raw=${videoFsPath}`);

  // If path is relative (starts with uploads or src/uploads), make it absolute
  if (!path.isAbsolute(videoFsPath)) {
    // Remove leading slash if present
    if (videoFsPath.startsWith("/") || videoFsPath.startsWith("\\")) {
      videoFsPath = videoFsPath.slice(1);
    }

    // If it already starts with src, join with projectRoot
    if (videoFsPath.startsWith("src")) {
      videoFsPath = path.join(projectRoot, videoFsPath);
    } else {
      // Otherwise assume it's in src/ (e.g. uploads/...)
      videoFsPath = path.join(projectRoot, "src", videoFsPath);
    }
  }

  videoFsPath = path.resolve(videoFsPath).replace(/\\/g, "/");
  console.log("🎞 Resolved Video Path:", videoFsPath);

  if (!fs.existsSync(videoFsPath)) {
    throw new Error(`Video file not found at: ${videoFsPath}`);
  }

  // ----------------------------------------------------
  // 2) EXTRACT RAW FRAMES
  // ----------------------------------------------------
  let framesDir = "";
  let frames = [];

  try {
    framesDir = await extractFrames(videoFsPath, jobId);

    frames = fs.readdirSync(framesDir)
      .filter(f => /\.(jpg|jpeg|png)$/i.test(f))
      .map(f => path.join(framesDir, f));

    console.log("🎬 Extracted raw frames:", frames.length);

    await Job.updateOne({ jobId }, { progress: 30 });

  } catch (err) {
    console.error("❌ Frame extraction failed:", err.message);
    // FAIL THE JOB HERE
    throw err;
  }

  // ----------------------------------------------------
  // 3) SELECT BEST SLIDE FRAMES
  // ----------------------------------------------------
  console.log("🔎 Selecting slide-like frames…");
  let selectedFrames = [];

  try {
    selectedFrames = await classifyFrames(framesDir, {
      dedupeDistance: 8,
      maxKeep: 30,
    });
  } catch (err) {
    console.error("❌ classifyFrames failed:", err);
  }

  if (!selectedFrames.length && frames.length > 0) {
    console.log("⚠ No slide frames found — using FIRST frame.");
    selectedFrames = [frames[0]];
  }

  console.log("👍 Frames after classifier:", selectedFrames.length);

  // Convert FS path → public path
  const publicFrames = selectedFrames.map(p =>
    p.replace(projectRoot + "/src", "").replace(/\\/g, "/")
  );

  await Job.updateOne(
    { jobId },
    { framesPath: publicFrames, progress: 45 }
  );

  // ----------------------------------------------------
  // 4) TRANSCRIPTION USING GROQ WHISPER
  // ----------------------------------------------------
  let transcript = "";
  let transcriptionData = {};

  try {
    const result = await runWhisper(videoFsPath);
    if (typeof result === "object") {
      transcript = result.text || "";
      transcriptionData = result;
    } else {
      transcript = result || "";
    }
  } catch (err) {
    console.log("Whisper failed:", err.message);
  }

  await Job.updateOne({ jobId }, {
    transcript,
    transcriptionData,
    progress: 65
  });

  // ----------------------------------------------------
  // 5) GENERATE FINAL NOTES (LLM)
  // ----------------------------------------------------
  const trimmedTranscript = transcript.slice(0, 8000);

  const notesPrompt = `
Generate clean lecture notes.

Transcript:
${trimmedTranscript}

Return:

## Key Points
- item

## Summary
paragraph

## Detailed Notes
- detail
`;

  let finalNotes = "";
  try {
    finalNotes = await groqText(notesPrompt);
  } catch (err) {
    finalNotes = "AI Notes generation failed.";
  }

  await Job.updateOne({ jobId }, { finalNotes, progress: 80 });

  // ----------------------------------------------------
  // 6) PDF GENERATION (SAFE)
  // ----------------------------------------------------
  let pdfPublic = null;

  try {
    pdfPublic = await buildCleanSlidesPDF(
      selectedFrames, // FS absolute paths
      jobId
    );

    await Job.updateOne(
      { jobId },
      { slidesPdf: pdfPublic, progress: 95 }
    );

    console.log("📄 Slides PDF:", pdfPublic);

  } catch (err) {
    console.log("❌ PDF creation failed:", err.message);
    await Job.updateOne(
      { jobId },
      { slidesPdf: null, progress: 95 }
    );
  }

  // ----------------------------------------------------
  // 7) DONE
  // ----------------------------------------------------
  await Job.updateOne({ jobId }, { status: "done", progress: 100 });

  return true;
}
