import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ message: "Invalid or missing token" });
  }

  try {
    const storedToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!storedToken) {
      return res.status(404).json({ message: "Invalid token" });
    }

    if (storedToken.expiresAt < new Date()) {
      return res.status(410).json({ message: "Token expired" });
    }

    await prisma.user.update({
      where: { email: storedToken.email },
      data: { emailVerified: new Date() },
    });

    await prisma.verificationToken.delete({
      where: { token },
    });

    return res.status(200).json({ message: "Email verified successfully!" });
  } catch (err) {
    console.error("Verification error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
}
