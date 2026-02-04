import { NextResponse } from "next/server";
import prisma from "../../../lib/prisma";

export async function GET() {
  const groupId = "g1"; // replace with dynamic later

  try {
    const groupMembers = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const users = groupMembers.map((gm) => ({
      id: gm.user.id,
      name: gm.user.name,
      email: gm.user.email,
      role: gm.role,
      joinedAt: gm.joinedAt,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching group users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users for this group" },
      { status: 500 }
    );
  }
}
