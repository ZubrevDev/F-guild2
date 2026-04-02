import { router, publicProcedure, protectedProcedure } from "../trpc";
import { authRouter } from "./auth";

export const appRouter = router({
  auth: authRouter,

  healthcheck: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return { userId: ctx.session.userId, role: ctx.session.role };
  }),
});

export type AppRouter = typeof appRouter;
