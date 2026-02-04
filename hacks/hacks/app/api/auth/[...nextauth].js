import NextAuth, { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import prisma from "../../../lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing email or password");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error("No account found with this email");
        }

        if (!user.password) {
          throw new Error("This account uses Google Sign-In only");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Incorrect password");
        }

        return user;
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = (user as any).isAdmin ?? false;
        token.emailVerified = Boolean((user as any).emailVerified);
        token.phoneVerified = Boolean((user as any).phoneVerified);
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
        session.user.emailVerified = token.emailVerified as boolean;
        session.user.phoneVerified = token.phoneVerified as boolean;
      }
      return session;
    },

async signIn({ user, account }) {
  try {
    if (!account?.provider || !user.email) return false;

    // PRELAUNCH MODE CHECK (KEEP THIS)
    const isPrelaunch = process.env.PRELAUNCH_MODE === "true";
    if (isPrelaunch) {
      const allowedUsers =
        process.env.PRELAUNCH_ALLOWED_USERS?.split(",") || [];
      const admins =
        process.env.PRELAUNCH_ALLOWED_ADMIN?.split(",") || [];

      const isAllowed =
        allowedUsers.includes(user.email) || admins.includes(user.email);

      if (!isAllowed) throw new Error("PRELAUNCH_ACCESS_DENIED");
    }

    // 🔥 IMPORTANT: DO NOT MANUALLY CREATE USER OR ACCOUNT HERE.
    // PrismaAdapter handles this automatically.

    return true;
  } catch (err) {
    console.error("signIn error:", err);
    return false;
  }
}

,
  },

  pages: {
    signIn: "/",
    signOut: "/",
    error: "/auth/error",
    verifyRequest: "/auth/verify-request",
    newUser: "/dashboard",
  },

  secret: process.env.NEXTAUTH_SECRET!,
};

export default NextAuth(authOptions);
