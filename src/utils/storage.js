import fs from "fs";
import path from "path";

const isVercel = process.env.VERCEL === '1';

export const UPLOAD_DIR = isVercel
  ? "/tmp"
  : (process.env.UPLOAD_DIR || path.join(process.cwd(), "src/uploads"));

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const SLIDES_DIR = path.join(UPLOAD_DIR, "slides");
if (!fs.existsSync(SLIDES_DIR)) {
  fs.mkdirSync(SLIDES_DIR, { recursive: true });
}

export function ensureUploadDir() {
  return UPLOAD_DIR;
}
