export async function checkSlipRdcw(payload) {
  const credentials = Buffer.from(`${process.env.RDCW_CLIENT_ID}:${process.env.RDCW_CLIENT_SECRET}`).toString("base64");

  const response = await fetch("https://suba.rdcw.co.th/v2/inquiry", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${credentials}`
    },
    body: JSON.stringify({ payload })
  });
  if (!response.ok) {
   return { code: response.status, message: "เช็คสลิปไม่สำเร็จ" } 
  }
  return await response.json();
}