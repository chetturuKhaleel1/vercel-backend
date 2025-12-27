// server/src/utils/imageHash.js
import sharp from "sharp";

/**
 * aHash: resize to 8x8 grayscale, compute average, build 64-bit string
 */
export async function aHash(imagePath) {
  const buf = await sharp(imagePath)
    .resize(8,8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer();

  // buf has 64 bytes (0-255)
  const avg = buf.reduce((s,n)=>s+n,0)/buf.length;
  let hash = "";
  for (const v of buf) hash += (v > avg ? "1" : "0");
  return hash; // 64-char '0'/'1' string
}

export function hammingDistance(hashA, hashB) {
  let d = 0;
  for (let i=0;i<hashA.length;i++) if (hashA[i] !== hashB[i]) d++;
  return d;
}
