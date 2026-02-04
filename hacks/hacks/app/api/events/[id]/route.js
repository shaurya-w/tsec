
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function DELETE(req, { params }) {
  try {
    // 1. Await params (Required for Next.js 15+)
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    // 2. Robust Delete: Use a Transaction to delete dependencies first
    // This prevents "Foreign Key Constraint" errors if your DB doesn't cascade automatically.
    await prisma.$transaction(async (tx) => {
      
      // Delete Transactions linked to this event
      await tx.transaction.deleteMany({ where: { eventId: id } });

      // Delete Expenses linked to categories of this event
      // (Finding categories first is safer)
      const categories = await tx.expenseCategory.findMany({ where: { eventId: id } });
      const categoryIds = categories.map(c => c.id);
      
      if (categoryIds.length > 0) {
          // Delete Category Members
          await tx.categoryMember.deleteMany({ where: { expenseCategoryId: { in: categoryIds } } });
          // Delete Expenses
          await tx.expense.deleteMany({ where: { categoryId: { in: categoryIds } } });
      }

      // Delete Categories
      await tx.expenseCategory.deleteMany({ where: { eventId: id } });

      // Delete Participants
      await tx.eventParticipant.deleteMany({ where: { eventId: id } });

      // Finally, Delete the Event
      await tx.event.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Delete Error:", error);
    return NextResponse.json(
      { error: "Failed to delete event: " + error.message },
      { status: 500 }
    );
  }
}