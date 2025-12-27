// server/src/services/slideBuilder.service.js
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { aHash, hammingDistance } from "../utils/imageHash.js";

// root for saving PDFs
const SLIDES_ROOT = path.join(process.cwd(), "src", "uploads", "slides");

/**
 * Build PDF from an array of ABSOLUTE selected slide frames.
 * @param {string[]} selectedFrames - absolute file system paths
 * @param {string} jobId 
 */
export const buildCleanSlidesPDF = async (selectedFrames, jobId, opts = {}) => {
  if (!Array.isArray(selectedFrames) || selectedFrames.length === 0) {
    throw new Error("selectedFrames must be a non-empty array");
  }

  console.log("🖼 Building PDF from frames:", selectedFrames.length);

  // --- 1) DEDUPE with hashing ---
  const keepFrames = [];
  const hashes = [];
  const HAMMING_THRESHOLD = opts.hammingThreshold ?? 10;

  for (const img of selectedFrames) {
    if (!fs.existsSync(img)) continue;

    let hash = null;

    try {
      hash = await aHash(img);
    } catch (err) {
      console.warn("⚠ Hash failed for:", img, err.message);
      keepFrames.push(img);
      continue;
    }

    let dup = false;
    for (const old of hashes) {
      const dist = hammingDistance(hash, old);
      if (dist <= HAMMING_THRESHOLD) {
        dup = true;
        break;
      }
    }

    if (!dup) {
      hashes.push(hash);
      keepFrames.push(img);
    }
  }

  if (!keepFrames.length) keepFrames.push(selectedFrames[0]);

  console.log("🧹 Frames after dedupe:", keepFrames.length);

  // --- 2) Create PDF output folder ---
  const jobDir = path.join(SLIDES_ROOT, jobId);
  if (!fs.existsSync(jobDir)) fs.mkdirSync(jobDir, { recursive: true });

  const pdfPath = path.join(jobDir, `${jobId}-slides.pdf`);

  // --- 3) Create PDF (A4 landscape) ---
  const doc = new PDFDocument({
    autoFirstPage: false,
    compress: true,
  });

  const ws = fs.createWriteStream(pdfPath);
  doc.pipe(ws);

  const PAGE_W = 842;
  const PAGE_H = 595;

  for (const img of keepFrames) {
    try {
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      doc.image(img, {
        fit: [PAGE_W, PAGE_H],
        align: "center",
        valign: "center",
      });
    } catch (err) {
      console.error("⚠ PDF render error:", img, err.message);
      doc.addPage({ size: [PAGE_W, PAGE_H], margin: 0 });
      doc.fontSize(18).fillColor("red").text("Error rendering slide.");
    }
  }

  doc.end();
  await new Promise((resolve) => ws.on("finish", resolve));

  console.log("📄 PDF CREATED:", pdfPath);

  // return public URL
  return `/slides/${jobId}/${jobId}-slides.pdf`;
};
