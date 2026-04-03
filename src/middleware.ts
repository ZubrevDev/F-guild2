import createIntlMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";

const { auth } = NextAuth(authConfig);
const intlMiddleware = createIntlMiddleware(routing);

const protectedPatterns = ["/dashboard", "/admin"];

function isProtectedPath(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|ru|fr)/, "");
  return protectedPatterns.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );
}

function needsGuildId(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|ru|fr)/, "");
  return pathWithoutLocale === "/dashboard" || pathWithoutLocale.startsWith("/dashboard/");
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isProtectedPath(pathname) && !req.auth) {
    const locale = pathname.match(/^\/(en|ru|fr)/)?.[1] || "en";
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  // Redirect to guild selection if dashboard access without guildId
  if (needsGuildId(pathname) && req.auth) {
    type AuthWithGuildId = {
      user?: { guildId?: string };
      guildId?: string;
    };
    const authObj = req.auth as unknown as AuthWithGuildId;
    const guildId = authObj?.user?.guildId ?? authObj?.guildId;
    if (!guildId) {
      const locale = pathname.match(/^\/(en|ru|fr)/)?.[1] || "en";
      return Response.redirect(new URL(`/${locale}/guilds`, req.url));
    }
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
