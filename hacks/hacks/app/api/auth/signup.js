import bcrypt from "bcrypt";
import crypto from "crypto";
import prisma from "../../../lib/prisma"
import { sendVerificationEmail } from "@/lib/mailer";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password, name } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required" });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || "",
      },
    });

    // Generate verification token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await prisma.verificationToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    // Send verification email
    const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(email, verifyUrl);

    return res.status(201).json({
      message: "Signup successful! Please verify your email.",
      user: {
        id: newUser.id,
        email: newUser.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
