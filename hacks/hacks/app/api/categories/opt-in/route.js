import { NextResponse } from "next/server";
import prisma from "../../../../lib/prisma";



export async function POST(req) {
  try {
    const { userId, categoryId, action } = await req.json();

    if (action === "JOIN") {
      // Use upsert to prevent unique constraint errors
      // If it exists, we do nothing (update to current values)
      // If it doesn't, we create it.
      await prisma.categoryMember.upsert({
        where: {
          userId_expenseCategoryId: {
            userId: userId,
            expenseCategoryId: categoryId,
          },
        },
        update: {}, // No changes needed if already joined
        create: {
          userId: userId,
          expenseCategoryId: categoryId,
        },
      });
    } else {
      // Action is LEAVE
      // We check if it exists before deleting to avoid "Record not found" errors
      await prisma.categoryMember.deleteMany({
        where: {
          userId: userId,
          expenseCategoryId: categoryId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Opt-in error:", error);
    return NextResponse.json(
      { error: "Database operation failed", details: error.message },
      { status: 500 }
    );
  }
}