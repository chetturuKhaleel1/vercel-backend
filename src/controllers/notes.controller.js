import { generateNotesFromVideo } from "../services/notes.service.js";

export const createNotes = async (req, res) => {
  try {
    const videoFile = req.file; // from multer upload
    if (!videoFile) return res.status(400).json({ success: false, message: "Video missing" });

    const videoPath = videoFile.path;

    const result = await generateNotesFromVideo(videoPath);
    return res.json(result);

  } catch (err) {
    console.error("Notes Controller Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
