import createIntlMiddleware from "next-intl/middleware";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { routing } from "./i18n/routing";

const { auth } = NextAuth(authConfig);
const intlMiddleware = createIntlMiddleware(routing);

const protectedPatterns = ["/dashboard"];

function isProtectedPath(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|ru|fr)/, "");
  return protectedPatterns.some(
    (p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(p + "/")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (isProtectedPath(pathname) && !req.auth) {
    const locale = pathname.match(/^\/(en|ru|fr)/)?.[1] || "en";
    const loginUrl = new URL(`/${locale}/login`, req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return Response.redirect(loginUrl);
  }

  return intlMiddleware(req);
});

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
