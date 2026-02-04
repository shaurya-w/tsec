import prisma from "../../../lib/prisma"
import { randomBytes } from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30 min expiry

    await prisma.verificationToken.create({
      data: {
        email,
        token,
        expiresAt,
      },
    });

    const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

    console.log("Verification URL:", verifyUrl);

    const response = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: email,
      subject: "Verify your email address",
      html: `
        <div style="font-family: sans-serif; line-height: 1.5;">
          <h2>Verify your email</h2>
          <p>Click below to verify your account:</p>
          <a href="${verifyUrl}" style="color: #ff7a00; font-weight: bold;">
            Verify Email
          </a>
          <p>If you didn’t request this, you can ignore this email.</p>
        </div>
      `,
    });

    console.log("Resend API response:", response);

    return res.status(200).json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Verification email error:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}
