import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Mirror the jwt callback shape so middleware can read guildId from the token.
    // The full jwt callback in auth.ts overrides this at runtime,
    // but the middleware NextAuth instance needs this to decode the token correctly.
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as Record<string, unknown>).isPlatformAdmin ? "platform_admin" : "master";
        token.guildId = ((user as Record<string, unknown>).guildId as string) ?? null;
      }
      if (trigger === "update" && (session as { guildId?: string })?.guildId) {
        token.guildId = (session as { guildId: string }).guildId;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role ?? "master";
      session.user.guildId = token.guildId ?? null;
      return session;
    },
  },
};
