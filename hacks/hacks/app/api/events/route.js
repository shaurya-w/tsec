import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      include: {
        // 1. Get Participants and their names
        participants: {
          include: { user: true }
        },
        // 2. CRITICAL FIX: Get Categories AND who has joined them
        categories: {
          include: {
            members: true, // <--- THIS WAS MISSING. NO MEMBERS = NO INTERACTIVITY.
          }
        }, 
      },
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json(events);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}