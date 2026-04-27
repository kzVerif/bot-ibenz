
import { Impit } from "impit";

export async function walletTopup(url) {
  try {
    const phone = process.env.PHONE_NUMBER;

    const voucher = url.split("=")[1];

    if (!voucher || !/^[a-z0-9]*$/i.test(voucher)) {
      return { status: false, reason: "Voucher ไม่ถูกต้อง" };
    }

    const data = JSON.stringify({
      mobile: phone,
      voucher_hash: voucher,
    });

    const client = new Impit({
      browser: "chrome",
      timeout: 30000,
    });
    

    const endpoint = `https://gift.truemoney.com/campaign/vouchers/${voucher}/redeem`;
    // const response = await fetch(endpoint, {
    const response = await client.fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-language": "en-US,en;q=0.6",
        "content-type": "application/json",
        priority: "u=1, i",
        "sec-fetch-dest": "empty",
        "sec-fetch-mode": "cors",
        "sec-fetch-site": "same-origin",
        "sec-gpc": "1",
        Referer: "https://gift.truemoney.com/campaign/card",
      },

      body: data,
    });

    const res = await response.json();

    // SUCCESS CHECK
    if (res.status?.code === "SUCCESS" && res.data?.voucher?.member === 1) {
      const amountText = res.data.voucher.redeemed_amount_baht.replace(",","")
      const amount = Number(amountText);

      if (truemoney?.feeAvailable === true) {
        if (amount * 0.029 < 20) {
          const finalAmount = Math.floor(amount - amount * 0.029);

          return {
            status: true,
            amount: finalAmount,
          };
        } else {
          const finalAmount = Math.floor(amount - 20);

          return {
            status: true,
            amount: finalAmount,
          };
        }
      }

      return {
        status: true,
        amount: amount,
      };
    } else {
      return {
        status: false,
        reason:
          res.data?.voucher?.member !== 1
            ? "กรุณาทำซองแบบรับคนเดียว"
            : res.status?.message,
      };
    }
  } catch (error) {
    console.log("TrueWallet: ", error);
    return {
      status: false,
      reason: "ไม่สามารตติดต่อกับ server ได้",
    };
  }
}