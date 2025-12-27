// server/src/utils/clipLocal.js
import { pipeline } from "@xenova/transformers";

// Load once globally
let clipModel = null;

// Load CLIP ViT-B-32 (fastest + supported)
export async function loadClip() {
  if (!clipModel) {
    console.log("🔻 Loading local CLIP model (Xenova)...");
    clipModel = await pipeline("feature-extraction", "Xenova/clip-vit-base-patch32");
    console.log("✅ CLIP model loaded (local)");
  }
  return clipModel;
}

/**
 * Classify image vs text prompt using cosine similarity
 * @param {string} imagePath absolute path
 * @param {string[]} textLabels array of labels
 */
export async function clipClassify(imagePath, textLabels = []) {
  try {
    const model = await loadClip();

    // Extract image features
    const img = await model(imagePath, { pooling: "mean", normalize: true });

    // Extract text features
    const txt = await model(textLabels, { pooling: "mean", normalize: true });

    // If single label → wrap in array
    const textFeats = Array.isArray(txt) ? txt : [txt];

    // Compute cosine similarity
    const scores = textFeats.map(
      (t) =>
        img
          .map((v, i) => v * t[i])
          .reduce((a, b) => a + b, 0)
    );

    return scores;
  } catch (err) {
    console.error("CLIP classify error:", err.message);
    return null;
  }
}
