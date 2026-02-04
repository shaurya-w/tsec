import prisma from "../../../../lib/prisma"; 
import { NextResponse } from "next/server";

export async function POST(req) {
  try {
    const { userId, categoryId, amount } = await req.json();

    // Use a transaction to ensure both updates happen, or neither happens
    const result = await prisma.$transaction(async (tx) => {
      
      // 1. Update the Category Pool
      const updatedCategory = await tx.expenseCategory.update({
        where: { id: categoryId },
        data: {
          totalPooled: { increment: amount }
        },
        include: { event: true } // Get event ID for the next step
      });

      // 2. Update the Main Event Pool
      const updatedEvent = await tx.event.update({
        where: { id: updatedCategory.eventId },
        data: {
          totalPooled: { increment: amount }
        }
      });

      // 3. Create a Record of the Transaction (Optional but recommended)
      await tx.transaction.create({
        data: {
          amount: amount,
          userId: userId,
          eventId: updatedCategory.eventId,
          categoryId: categoryId,
          status: "SUCCESS",
          // ... any other required fields
        }
      });

      return updatedCategory;
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error("Deposit error:", error);
    return NextResponse.json({ error: "Failed to process deposit" }, { status: 500 });
  }
}