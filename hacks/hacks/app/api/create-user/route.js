import prisma from "../../../lib/prisma";
import { NextResponse } from "next/server";

// ================= CREATE USER =================
export async function POST(req) {
  try {
    const body = await req.json();

    const user = await prisma.user.create({
      data: body,
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

// ================= GET USERS =================
export async function GET() {
  try {
    const users = await prisma.user.findMany();

    return NextResponse.json(users);
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
