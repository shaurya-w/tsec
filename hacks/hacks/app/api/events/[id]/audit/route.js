import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req, { params }) {
  // 1️⃣ Fix: Await params (required in newer Next.js versions)
  const { id } = await params;

  const logs = await prisma.transaction.findMany({
    where: { 
        eventId: id 
        // 2️⃣ Fix: Removed 'status' filter so we see EVERYTHING (Pending, Success, Failed)
    },
    include: { user: true }, 
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json(logs);
}