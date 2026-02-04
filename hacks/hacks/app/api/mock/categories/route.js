import prisma from "../../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const cats = await prisma.expenseCategory.findMany({
    include: {
      members: { include: { user: true } },
    },
  });

  return NextResponse.json(cats);
}