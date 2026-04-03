import { router, publicProcedure, protectedProcedure } from "../trpc";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { guildRouter } from "./guild";
import { playerRouter } from "./player";
import { characterRouter } from "./character";
import { questRouter } from "./quest";
import { diceRouter } from "./dice";
import { buffRouter } from "./buff";
import { shopRouter } from "./shop";
import { prayerRouter } from "./prayer";
import { activityRouter } from "./activity";
import { settingsRouter } from "./settings";
import { notificationRouter } from "./notification";
import { subscriptionRouter } from "./subscription";
import { pushRouter } from "./push";

export const appRouter = router({
  admin: adminRouter,
  auth: authRouter,
  guild: guildRouter,
  player: playerRouter,
  character: characterRouter,
  quest: questRouter,
  dice: diceRouter,
  buff: buffRouter,
  shop: shopRouter,
  prayer: prayerRouter,
  activity: activityRouter,
  settings: settingsRouter,
  notification: notificationRouter,
  subscription: subscriptionRouter,
  push: pushRouter,

  healthcheck: publicProcedure.query(() => {
    return { status: "ok", timestamp: new Date().toISOString() };
  }),

  me: protectedProcedure.query(({ ctx }) => {
    return { userId: ctx.session.userId, role: ctx.session.role };
  }),
});

export type AppRouter = typeof appRouter;
