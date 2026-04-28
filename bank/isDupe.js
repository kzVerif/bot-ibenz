import fs from "fs";

export function checkAndSaveSlip(refId) {
  // โหลดไฟล์ JSON
  const db = JSON.parse(fs.readFileSync("slip.json", "utf8"));
  console.log(db.ref);
  if (refId in db.ref) {
    return { success: false, message: "\`❌\` \`:\` \`สลิปซ้ำ\`" };
  }

  db.ref[refId] = true;
  fs.writeFileSync("slip.json", JSON.stringify(db, null, 2));
  return { success: true, message: "\`✅\` \`:\` \`สลิปใหม่\`" };
}

