import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

// กำหนด path แบบ absolute เทียบกับตำแหน่งของไฟล์นี้
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SLIP_PATH = path.join(__dirname, "slip.json");

export function checkAndSaveSlip(refId) {
  const db = JSON.parse(fs.readFileSync(SLIP_PATH, "utf8"));

  if (refId in db.ref) {
    return { success: false, message: "สลิปซ้ำ" };
  }

  db.ref[refId] = true;
  fs.writeFileSync(SLIP_PATH, JSON.stringify(db, null, 2));
  return { success: true, message: "`✅` `:` `สลิปใหม่`" };
}