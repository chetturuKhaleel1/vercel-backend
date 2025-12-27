// server/src/services/frameClassifier.service.js
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { pipeline, RawImage } from "@xenova/transformers";
import { runOCROnImage } from "./ocr.service.js";

// ------------------------------------
// CLIP model loader (Xenova)
let clipModel = null;
async function loadClip() {
  if (!clipModel) {
    console.log("🔻 Loading CLIP zero-shot model (Xenova)...");
    clipModel = await pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32");
    console.log("✅ CLIP zero-shot model ready!");
  }
  return clipModel;
}

// ------------------------------------
// Labels for slide detection
// ------------------------------------
const POSITIVE_LABELS = [
  "presentation slide",
  "powerpoint slide",
  "digital text document",
  "screen capture",
  "diagram and text",
  "whiteboard with writing",
  "handwritten lecture notes",
  "paper with handwriting",
  "text on paper"
];

const NEGATIVE_LABELS = [
  "person speaking",
  "human face",
  "blurry image",
  "motion blur",
  "transition effect",
  "out of focus",
  "audience",
  "wall",
  "natural scenery",
  "hand blocking text",
  "hand covering text",
  "arm obscuring view",
  "close up of hand",
  "person blocking screen",
  "person standing in front of whiteboard",
  "person obscuring presentation",
  "body blocking text",
  "teacher blocking board"
];

// ------------------------------------
// UTILS: Average Hash (aHash) for dedupe
//  - fast 8x8 grayscale average hash
// ------------------------------------
async function averageHash(filePath) {
  try {
    const image = sharp(filePath);
    const meta = await image.metadata();

    // Safety check for tiny/corrupt images
    if (!meta.width || !meta.height || meta.width < 10 || meta.height < 10) {
      return "0000000000000000";
    }

    // produce 8x8 grayscale image then compute hash bits
    const buf = await image
      .resize(8, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer(); // returns Buffer of 64 bytes (0-255)

    // compute mean
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i];
    const mean = sum / buf.length;

    // build bitstring
    let bitstr = "";
    for (let i = 0; i < buf.length; i++) {
      bitstr += buf[i] > mean ? "1" : "0";
    }

    // convert to hex (16 hex chars)
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      const nibble = bitstr.slice(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }

    return hex;
  } catch (err) {
    console.warn("Hash error:", err.message);
    return "0000000000000000";
  }
}

function hammingDistanceHex(a, b) {
  // both are hex strings length 16
  const aBin = hexToBin(a);
  const bBin = hexToBin(b);
  let dist = 0;
  for (let i = 0; i < aBin.length; i++) if (aBin[i] !== bBin[i]) dist++;
  return dist;
}
function hexToBin(hex) {
  return hex.split("").map(h => parseInt(h, 16).toString(2).padStart(4, "0")).join("");
}

// ------------------------------------
// CLASSIFY ONE FRAME (Optimized: CLIP First)
// 1) Run CLIP -> If "person" or "blur", reject immediately (Speed boost)
// 2) If CLIP is unsure or positive -> Run OCR
// 3) Combine scores for high accuracy
// ------------------------------------
export async function classifyFrame(imagePath) {
  try {
    // 0) Safety Check: Image Size
    const meta = await sharp(imagePath).metadata();
    if (!meta.width || !meta.height || meta.width < 50 || meta.height < 50) {
      console.warn(`🗑 ${path.basename(imagePath)} → Too small (${meta.width}x${meta.height})`);
      return { keep: false, score: 0, reason: "too_small" };
    }

    // 1) CLIP First (Fastest filter)
    const clip = await loadClip();
    const image = await RawImage.read(imagePath);
    const results = await clip(image, [...POSITIVE_LABELS, ...NEGATIVE_LABELS]);

    const best = results.sort((a, b) => b.score - a.score)[0];
    const isPositive = POSITIVE_LABELS.includes(best.label);
    const clipScore = best.score || 0;

    // FAST REJECT: If it's definitely a negative label (person, blur, hand blocking, etc)
    // Reject if negative AND score is significant (>0.30) - Relaxed from 0.20 to avoid false negatives
    if (!isPositive && clipScore > 0.30) {
      console.log(`🗑 ${path.basename(imagePath)} → Rejected by CLIP: ${best.label} (${clipScore.toFixed(2)})`);
      return { keep: false, score: 0, reason: "clip_reject", label: best.label };
    }

    // 2) OCR (Only if CLIP didn't reject)
    let ocrText = "";
    try {
      ocrText = await runOCROnImage(imagePath);
    } catch (e) {
      console.warn("OCR failed:", e.message);
    }

    const textLen = (ocrText || "").replace(/\s+/g, " ").trim().length;

    // 3) SCORING LOGIC
    // Base score is CLIP score (if positive) or 0.1 (if negative but low confidence)
    let finalScore = isPositive ? clipScore : 0.1;

    // Boost score with text
    if (textLen > 30) finalScore += 0.15; // Moderate text
    if (textLen > 50) finalScore += 0.2;
    if (textLen > 150) finalScore += 0.3; // Strong text signal

    // Penalize if CLIP was negative (but we are here because it wasn't > 0.30)
    if (!isPositive) finalScore -= 0.1;

    console.log(`🔎 ${path.basename(imagePath)} → CLIP=${best.label}(${clipScore.toFixed(2)}) | Text=${textLen} | Final=${finalScore.toFixed(2)}`);

    // 4) DECISION
    // Threshold: 0.28 (Relaxed from 0.35 to catch more slides)
    if (finalScore >= 0.28) {
      return { keep: true, score: finalScore, reason: "composite", label: best.label, textLen };
    }

    return { keep: false, score: finalScore, reason: "low_score" };

  } catch (err) {
    console.error("Classify error:", err.message || err);
    return { keep: false, score: 0, reason: "error" };
  }
}

// Helper for concurrency
async function mapLimit(items, limit, fn) {
  const results = [];
  const executing = [];
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    const e = p.then(() => executing.splice(executing.indexOf(e), 1));
    executing.push(e);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// ------------------------------------
// CLASSIFY ALL FRAMES: returns kept frames (deduped)
//  - framesDir: absolute directory or array of frame paths
//  - options: { dedupeDistance: int (hamming), maxKeep: int }
// ------------------------------------
export async function classifyFrames(framesDirOrList, options = {}) {
  const dedupeDistance = options.dedupeDistance ?? 5; // Lowered to 5 to keep more similar slides (progressive reveal)
  const maxKeep = options.maxKeep ?? 30;

  // normalize list
  const files = Array.isArray(framesDirOrList)
    ? framesDirOrList
    : fs.readdirSync(framesDirOrList).filter(f => /\.(jpg|jpeg|png)$/i.test(f)).map(f => path.join(framesDirOrList, f)).sort();

  console.log(`🚀 Classifying ${files.length} frames with concurrency...`);

  // Process in parallel with limit
  const candidateInfo = await mapLimit(files, 4, async (file) => {
    const info = await classifyFrame(file);
    return { path: file, ...info };
  });

  // Filter keeps
  let keeps = candidateInfo.filter(c => c.keep).sort((a, b) => b.score - a.score);

  // If no keeps, fallback to top-1 by score (balanced)
  if (keeps.length === 0) {
    const fallback = candidateInfo.sort((a, b) => b.score - a.score)[0];
    if (fallback) keeps = [fallback];
  }

  // Dedupe by averageHash + hamming distance
  const final = [];
  const hashes = [];

  for (const item of keeps) {
    if (!fs.existsSync(item.path)) continue;
    const h = await averageHash(item.path);
    let dup = false;
    for (const existing of hashes) {
      const dist = hammingDistanceHex(h, existing.hex);
      if (dist <= dedupeDistance) { dup = true; break; }
    }
    if (!dup) {
      hashes.push({ hex: h, path: item.path });
      final.push(item.path);
    }
    if (final.length >= maxKeep) break;
  }

  console.log("🎯 FINAL KEPT FRAMES:", final.length);
  return final;
}
