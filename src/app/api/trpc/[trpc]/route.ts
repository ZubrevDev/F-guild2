import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/routers/_app";
import { createContext } from "@/server/trpc";
import { auth } from "@/auth";

async function handler(req: Request) {
  const session = await auth();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () =>
      createContext({
        session: session?.user?.id
          ? { userId: session.user.id, role: "master" }
          : undefined,
      }),
  });
}

export { handler as GET, handler as POST };
