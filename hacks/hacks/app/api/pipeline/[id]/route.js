import { NextResponse } from "next/server";

const BASE = "https://api.fmm.finternetlab.io/api/v1";

export async function POST(req, context) {
  const { id } = await context.params;

  // 1️⃣ Wait until payment is PROCESSING
  let intent;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${BASE}/payment-intents/${id}`, {
      headers: { "X-API-Key": process.env.FINTERNET_API_KEY },
    });
    intent = await res.json();

    if (intent.status === "PROCESSING") break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 2️⃣ Get escrow
  const escrowRes = await fetch(
    `${BASE}/payment-intents/${id}/escrow`,
    {
      headers: { "X-API-Key": process.env.FINTERNET_API_KEY },
    }
  );
  const escrow = await escrowRes.json();

  // 3️⃣ Submit delivery proof
  const proofRes = await fetch(
    `${BASE}/payment-intents/${id}/escrow/delivery-proof`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.FINTERNET_API_KEY,
      },
      body: JSON.stringify({
        proofHash:
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        proofURI: "https://demo.local/proof/" + id,
        submittedBy: escrow.data.buyerAddress,
      }),
    }
  );
  const proof = await proofRes.json();

  return NextResponse.json({
    escrow,
    proof,
  });
}
