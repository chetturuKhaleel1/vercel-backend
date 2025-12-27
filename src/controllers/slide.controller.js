// server/src/controllers/slide.controller.js
import path from "path";
import { extractFrames } from "../services/frameExtractor.service.js";
import { buildCleanSlidesPDF } from "../services/slideBuilder.service.js";

export const generateSlidesFromVideo = async (req, res) => {
  try {
    const { videoPath, jobId, fps } = req.body;
    if (!videoPath || !jobId) return res.status(400).json({ success:false, error: "videoPath, jobId required" });

    // 1) extract frames
    const framesDir = await extractFrames(videoPath, jobId, { fps: fps ?? 1 });

    // 2) build clean pdf
    const pdfPath = await buildCleanSlidesPDF(framesDir, jobId);

    // return relative path so frontend can download (adjust to your static serve)
    const relPath = path.relative(process.cwd(), pdfPath);
    return res.json({ success: true, pdfPath: `/${relPath}` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
