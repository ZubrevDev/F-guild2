import { z } from "zod/v4";
import { hash } from "bcryptjs";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";

export const authRouter = router({
  register: publicProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100),
        email: z.email(),
        password: z.string().min(8).max(128),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already registered",
        });
      }

      const passwordHash = await hash(input.password, 12);
      const user = await ctx.db.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash,
        },
      });

      return { id: user.id, email: user.email, name: user.name };
    }),
});
