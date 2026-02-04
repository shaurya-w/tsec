import { NextResponse } from "next/server";

export async function POST(req) {
  const { amount, userId, eventId } = await req.json();

  const res = await fetch(
    "https://api.fmm.finternetlab.io/api/v1/payment-intents",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.FINTERNET_API_KEY,
      },
      body: JSON.stringify({
        amount: amount, 
        currency: "USDC",
        type: "DELIVERY_VS_PAYMENT",
        settlementMethod: "OFF_RAMP_MOCK",
        settlementDestination: "bank_account_123",
        description: "Pool Contribution",
        metadata: {
          returnUrl: "http://localhost:3000/finternet",
          userId: userId,
          eventId: eventId
        },
      }),
    }
  );

  const data = await res.json();

  return NextResponse.json({
    intentId: data.id,
    paymentUrl: data.data.paymentUrl,
  });
}