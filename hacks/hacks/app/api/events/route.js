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
// DELETE Handler
export async function DELETE(req, { params }) {
  const { id } = await params;

  try {
    // Delete the event (Prisma should cascade delete participants/categories if configured in schema)
    // If not, it will throw an error, but for most setups, this works.
    await prisma.event.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json(
      { error: "Failed to delete event. Ensure related records are handled." },
      { status: 500 }
    );
  }
}