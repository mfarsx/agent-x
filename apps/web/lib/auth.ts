import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@agent-social/db";

const HANDLE_RE = /^[a-zA-Z0-9_]{1,32}$/;

function isValidHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE_RE.test(value);
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Handle",
      credentials: {
        handle: { label: "Handle", type: "text" },
      },
      async authorize(credentials) {
        const handle = credentials?.handle;
        if (!isValidHandle(handle)) return null;

        const user = await db.user.findUnique({
          where: { handle },
          select: { id: true, name: true, email: true, image: true, handle: true },
        });
        if (!user?.handle) return null;

        return {
          id: user.id,
          name: user.name ?? user.handle,
          email: user.email,
          image: user.image,
          handle: user.handle,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.handle = user.handle;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.handle = typeof token.handle === "string" ? token.handle : undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
};
