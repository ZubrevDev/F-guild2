import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import Apple from "next-auth/providers/apple";
import { compare } from "bcryptjs";
import { db } from "@/server/db";
import { authConfig } from "./auth.config";

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

        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Only handle OAuth providers here; Credentials handled by authorize()
      if (!account || account.provider === "credentials") return true;

      const email = user.email;
      if (!email) return false;

      const provider = account.provider; // "google" | "apple"

      const existingUser = await db.user.findUnique({ where: { email } });

      if (existingUser) {
        // Link OAuth provider to the existing account if not yet set
        if (!existingUser.oauthProvider) {
          await db.user.update({
            where: { email },
            data: { oauthProvider: provider },
          });
        }
        // Carry the DB id back so jwt callback can use it
        user.id = existingUser.id;
      } else {
        // First OAuth login — create user in DB
        const created = await db.user.create({
          data: {
            email,
            name: user.name ?? email.split("@")[0],
            oauthProvider: provider,
          },
        });
        user.id = created.id;
      }

      return true;
    },
  },
});
