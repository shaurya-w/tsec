export async function POST() {
  const res = await fetch(
    "https://api.fmm.finternetlab.io/api/v1/payment-intents",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.FINTERNET_API_KEY,
      },
      body: JSON.stringify({
        amount: "225.00",
        currency: "USDC",
        type: "DELIVERY_VS_PAYMENT",
        settlementMethod: "OFF_RAMP_MOCK",
        settlementDestination: "bank_account_123",
        description: "Pool for Movie Tickets",
        metadata: {
          returnUrl: "http://localhost:3000/finternet",
        },
      }),
    }
  );

  const data = await res.json();

  return Response.json({
    intentId: data.id,
    paymentUrl: data.data.paymentUrl,
  });
}
