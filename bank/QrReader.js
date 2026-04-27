// QrReader.js
import jsQR from "jsqr";
import sharp from "sharp";

export async function decodeSlipQRCode(blob) {
  // แปลง Blob → Buffer
  const arrayBuffer = await blob.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);

  // ดึงข้อมูลรูปภาพ
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const origW = metadata.width;
  const origH = metadata.height;

  // ย่อรูปถ้ากว้างเกิน 1400px
  const maxW = 1400;
  const scale = Math.min(1, maxW / origW);
  const baseW = Math.round(origW * scale);
  const baseH = Math.round(origH * scale);

  // resize แล้วแปลงเป็น raw RGBA
  const baseBuffer = await sharp(inputBuffer)
    .resize(baseW, baseH)
    .ensureAlpha()
    .raw()
    .toBuffer();

  // กำหนด regions ที่จะ scan
  const regions = [
    { x: 0, y: 0, w: baseW, h: baseH },
    { x: 0, y: Math.floor(baseH * 0.45), w: baseW, h: Math.floor(baseH * 0.55) },
    { x: Math.floor(baseW * 0.5), y: Math.floor(baseH * 0.5), w: Math.floor(baseW * 0.5), h: Math.floor(baseH * 0.5) },
    { x: 0, y: Math.floor(baseH * 0.5), w: Math.floor(baseW * 0.5), h: Math.floor(baseH * 0.5) },
    { x: Math.floor(baseW * 0.5), y: 0, w: Math.floor(baseW * 0.5), h: Math.floor(baseH * 0.5) },
    { x: 0, y: 0, w: Math.floor(baseW * 0.5), h: Math.floor(baseH * 0.5) },
  ];

  // ตัด region จาก raw buffer
  const cropRaw = async (r) => {
    return sharp(baseBuffer, { raw: { width: baseW, height: baseH, channels: 4 } })
      .extract({ left: r.x, top: r.y, width: r.w, height: r.h })
      .raw()
      .toBuffer();
  };

  // แปลงเป็นขาวดำ
  const binarize = (data) => {
    const result = Buffer.from(data);
    for (let i = 0; i < result.length; i += 4) {
      let gray = result[i] * 0.299 + result[i + 1] * 0.587 + result[i + 2] * 0.114;
      gray = Math.min(255, Math.max(0, (gray - 128) * 1.2 + 128));
      const v = gray < 150 ? 0 : 255;
      result[i] = result[i + 1] = result[i + 2] = v;
      result[i + 3] = 255;
    }
    return result;
  };

  // decode ด้วย jsQR
  const tryDecode = (data, w, h) => {
    const result = jsQR(new Uint8ClampedArray(data), w, h);
    return result?.data || null;
  };

  // ไล่ scan ทีละ region
  for (const r of regions) {
    const raw = await cropRaw(r);

    // A) สีปกติ
    let out = tryDecode(raw, r.w, r.h);
    if (out) return out;

    // B) ขาวดำ
    const bw = binarize(raw);
    out = tryDecode(bw, r.w, r.h);
    if (out) return out;
  }

  return null; // ไม่เจอ QR Code ในทุก region
}