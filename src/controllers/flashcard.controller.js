import { generateFlashcards } from "../services/flashcard.service.js";
import Job from "../models/job.model.js";

export async function getFlashcards(req, res) {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ jobId }).lean();

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Use finalNotes or fallback to notes
    const notes = job.finalNotes || job.notes || "";
    const transcript = job.transcript || "";

    // ⭐ IMPORTANT FIX:
    // Flashcards must generate EVEN IF job failed.
    if (!notes && !transcript) {
      return res.json({
        jobId,
        count: 0,
        cards: [],
      });
    }

    // Generate flashcards through Gemini
    const cards = await generateFlashcards({ notes, transcript });

    return res.json({
      jobId,
      count: cards.length,
      cards,
    });

  } catch (err) {
    console.error("Flashcard controller error:", err);
    return res.status(500).json({
      error: "Server error generating flashcards",
    });
  }
}
