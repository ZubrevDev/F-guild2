import NextAuth from "next-auth";
import type { User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { compare } from "bcryptjs";
import { db } from "@/server/db";
import { authConfig } from "./auth.config";

/** Extended user shape returned by authorize() and mutated by signIn() */
interface ExtendedUser extends User {
  isPlatformAdmin: boolean;
  guildId: string | null;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_ID!,
      clientSecret: process.env.APPLE_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await db.user.findUnique({
          where: { email },
          include: {
            guildMasters: {
              select: { guildId: true },
              take: 1,
            },
          },
        });
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isPlatformAdmin: user.isPlatformAdmin,
          guildId: user.guildMasters[0]?.guildId ?? null,
        } satisfies ExtendedUser;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial login
      if (user) {
        const extUser = user as ExtendedUser;
        token.id = extUser.id as string;
        // TODO: "player" role is not assigned here — players authenticate via PIN/QR (separate flow, not NextAuth)
        token.role = extUser.isPlatformAdmin ? "platform_admin" : "master";
        token.guildId = extUser.guildId ?? null;
      }
      // Client-side session update (guild switching)
      if (trigger === "update" && (session as { guildId?: string })?.guildId) {
        const requestedGuildId = (session as { guildId: string }).guildId;
        const { db } = await import("@/server/db");
        const membership = await db.guildMaster.findUnique({
          where: { guildId_userId: { guildId: requestedGuildId, userId: token.id as string } },
          select: { guildId: true },
        });
        if (membership) {
          token.guildId = requestedGuildId;
        }
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role ?? "master";
      session.user.guildId = token.guildId ?? null;
      return session;
    },
    async signIn({ user, account }) {
      // Only handle OAuth providers here; Credentials handled by authorize()
      if (!account || account.provider === "credentials") return true;

      const email = user.email;
      if (!email) return false;

      const provider = account.provider; // "google" | "apple"

      const existingUser = await db.user.findUnique({
        where: { email },
        include: { guildMasters: { select: { guildId: true }, take: 1 } },
      });

      const extUser = user as ExtendedUser;

      if (existingUser) {
        // Link OAuth provider to the existing account if not yet set
        if (!existingUser.oauthProvider) {
          await db.user.update({
            where: { email },
            data: { oauthProvider: provider },
          });
        }
        // Carry the DB id and extra fields back so jwt callback can use them
        extUser.id = existingUser.id;
        extUser.isPlatformAdmin = existingUser.isPlatformAdmin;
        extUser.guildId = existingUser.guildMasters[0]?.guildId ?? null;
      } else {
        // First OAuth login — create user in DB
        const created = await db.user.create({
          data: {
            email,
            name: user.name ?? email.split("@")[0],
            oauthProvider: provider,
          },
        });
        extUser.id = created.id;
        extUser.isPlatformAdmin = false;
        extUser.guildId = null;
      }

      return true;
    },
  },
});
