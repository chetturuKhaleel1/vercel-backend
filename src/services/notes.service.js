import { extractFrames } from "./ffmpeg.service.js";
import { groqVision, groqText } from "../utils/groq.js";
import fs from "fs";
import path from "path";

export const generateNotesFromVideo = async (videoPath) => {
  try {
    console.log("📌 Starting Notes Pipeline...");

    // 1. Extract frames
    const frames = await extractFrames(videoPath); 
    console.log("🖼️ Frames extracted:", frames.length);

    let extractedText = "";

    // 2. Pass each frame through Groq Vision
    for (const framePath of frames) {
      const imgData = fs.readFileSync(framePath, { encoding: "base64" });
      const base64 = `data:image/png;base64,${imgData}`;

      const visionResponse = await groqVision(
        base64,
        "Extract all text from this video frame. Keep maximum accuracy."
      );

      extractedText += "\n" + visionResponse;

      // Optional: Delete frame after reading
      fs.unlinkSync(framePath);
    }

    console.log("📝 Extracted Raw Text:", extractedText.slice(0, 200));

    // 3. Clean the text
    const cleanedText = extractedText.replace(/\s+/g, " ").trim();

    // 4. Generate structured notes using Groq LLM
    const summaryPrompt = `
You are an AI note generator. Convert the following extracted text into clean, structured, 
easy-to-understand notes.

TEXT:
${cleanedText}

Return output in:

## Key Points
- point 1
- point 2

## Summary
Short summary paragraph.

## Important Terms
- term - meaning
`;

    const notes = await groqText(summaryPrompt);

    console.log("📘 Notes Generated");

    return {
      success: true,
      notes,
    };

  } catch (error) {
    console.error("❌ Notes Generation Error:", error);
    return { success: false, error: error.message };
  }
};
