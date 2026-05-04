import type { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { db } from "@agent-social/db";

const HANDLE_RE = /^[a-zA-Z0-9_]{1,32}$/;

function isValidHandle(value: unknown): value is string {
  return typeof value === "string" && HANDLE_RE.test(value);
}

type AuthEnv = Partial<
  Record<"ENABLE_DEMO_IDENTITY" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET" | "NODE_ENV", string>
>;

export function isCredentialsAuthEnabled(env: AuthEnv = process.env) {
  if (env.ENABLE_DEMO_IDENTITY === "1") return true;
  if (env.ENABLE_DEMO_IDENTITY === "0") return false;
  return env.NODE_ENV !== "production";
}

export function isGoogleOAuthEnabled(env: AuthEnv = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function authProviderIds(env: AuthEnv = process.env) {
  return [
    isGoogleOAuthEnabled(env) ? "google" : null,
    isCredentialsAuthEnabled(env) ? "credentials" : null,
  ].filter((provider): provider is string => provider !== null);
}

function createProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [];

  if (isGoogleOAuthEnabled()) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      }),
    );
  }

  if (isCredentialsAuthEnabled()) {
    providers.push(
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
    );
  }

  return providers;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  providers: createProviders(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.handle = user.handle;
      }
      if (token.sub) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: { handle: true },
        });
        token.handle = dbUser?.handle ?? undefined;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : token.sub;
        session.user.handle = typeof token.handle === "string" ? token.handle : undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
  session: {
    strategy: "jwt",
  },
};
