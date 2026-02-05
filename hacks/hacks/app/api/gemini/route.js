import OpenAI from "openai"
import { NextResponse } from "next/server"
import { NextRequest } from "next/server"


export const runtime = "nodejs"

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
})

export async function POST(req) {
  try {
    const { message } = await req.json()

    const response = await openai.chat.completions.create({
      model: "gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            `You are an AI travel planning assistant.

Your task:
- Generate a 3-step travel itinerary.
- Each step must be a single activity or plan item.
- Each step must include an estimated cost in INR.
- Costs must be realistic but approximate.

STRICT RULES:
- Respond ONLY in valid JSON.
- Do NOT include explanations, markdown, or extra text.
- Do NOT include currency symbols.
- Return EXACTLY 3 objects.

JSON FORMAT (must match exactly):
{
  "itinerary": [
    {
      "item": "string",
      "estimated_cost": number
    },
    {
      "item": "string",
      "estimated_cost": number
    },
    {
      "item": "string",
      "estimated_cost": number
    }
  ]
}
`
        },
        {
          role: "user",
          content: message,
        },
      ],
    })

    return NextResponse.json({
      reply: response.choices[0].message,
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    itinerary: [
      {
        item: "Day 1: Arrival in Goa, beach visit, and local seafood dinner",
        estimated_cost: 4000
      },
      {
        item: "Day 2: Water sports, scooter rental, and cafe hopping",
        estimated_cost: 6000
      },
      {
        item: "Day 3: Shopping, sightseeing, and return travel",
        estimated_cost: 3000
      }
    ]
  });
}