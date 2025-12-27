// server/src/services/ocr.service.js
import Tesseract from "tesseract.js";
import fs from "fs";
import path from "path";

export async function runOCROnImage(imagePath) {
  try {
    // ---- 1) SAFETY CHECK: FILE EXISTS ----
    if (!fs.existsSync(imagePath)) {
      console.warn("⚠ OCR skipped: image not found:", imagePath);
      return "";
    }

    // ---- 2) SAFETY CHECK: FILE NOT EMPTY ----
    const { size } = fs.statSync(imagePath);
    if (size < 1000) {
      console.warn("⚠ OCR skipped: corrupted/empty frame:", imagePath);
      return "";
    }

    // ---- 3) ABS PATH (Windows safe) ----
    const absolute = path.resolve(imagePath).replace(/\\/g, "/");

    // ---- 4) PERFORM OCR ----
    const result = await Tesseract.recognize(absolute, "eng", {
      logger: () => {}   // silent
    });

    return result.data?.text?.trim() || "";

  } catch (err) {
    console.error("❌ OCR error:", err);
    return "";
  }
}
