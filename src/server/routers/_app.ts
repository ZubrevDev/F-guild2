import { router, publicProcedure, protectedProcedure } from "../trpc";
import { authRouter } from "./auth";
import { guildRouter } from "./guild";
import { playerRouter } from "./player";

export const appRouter = router({
  auth: authRouter,
  guild: guildRouter,
  player: playerRouter,

  healthcheck: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return { userId: ctx.session.userId, role: ctx.session.role };
  }),
});

export type AppRouter = typeof appRouter;
