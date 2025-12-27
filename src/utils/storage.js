import fs from "fs";
import path from "path";

export function ensureUploadDir() {
  const dir = process.env.UPLOAD_DIR || path.join(process.cwd(), "src/uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
