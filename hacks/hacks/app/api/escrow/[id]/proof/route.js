export async function POST(req, context) {
  const { id } = await context.params;

  const res = await fetch(
    `https://api.fmm.finternetlab.io/api/v1/payment-intents/${id}/escrow/delivery-proof`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.FINTERNET_API_KEY,
      },
      body: JSON.stringify({
        proofHash:
          "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        proofURI: "https://example.com/proof",
        submittedBy: "0x5D478B369769183F05b70bb7a609751c419b4c04",
      }),
    }
  );

  const data = await res.json();
  return Response.json(data);
}
