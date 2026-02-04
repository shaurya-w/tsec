export async function GET(req, context) {
  const { id } = await context.params;

  const res = await fetch(
    `https://api.fmm.finternetlab.io/api/v1/payment-intents/${id}`,
    {
      headers: {
        "X-API-Key": process.env.FINTERNET_API_KEY,
      },
    }
  );

  const data = await res.json();
  return Response.json(data);
}
