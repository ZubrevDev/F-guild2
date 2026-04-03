/**
 * Admin tRPC router.
 * All procedures are protected by adminProcedure — platform_admin role required.
 */

import { z } from "zod";
import { router, adminProcedure } from "../trpc";
import { sendEmail } from "@/lib/email";

export const adminRouter = router({
  /**
   * Platform-wide statistics.
   */
  stats: adminProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [totalUsers, totalGuilds, activeGuilds, totalPlayers] =
      await Promise.all([
        ctx.db.user.count({ where: { deletedAt: null } }),
        ctx.db.guild.count({ where: { deletedAt: null } }),
        ctx.db.guild.count({
          where: {
            deletedAt: null,
            lastActivityAt: { gte: thirtyDaysAgo },
          },
        }),
        ctx.db.player.count(),
      ]);

    return { totalUsers, totalGuilds, activeGuilds, totalPlayers };
  }),

  /**
   * Paginated guild list with optional search and status filter.
   */
  guilds: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["active", "inactive", "deleted"]).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { search, status, page, limit } = input;
      const skip = (page - 1) * limit;

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Build where clause based on status filter
      let whereClause: Record<string, unknown> = {};

      if (status === "deleted") {
        whereClause = { deletedAt: { not: null } };
      } else if (status === "active") {
        whereClause = {
          deletedAt: null,
          lastActivityAt: { gte: thirtyDaysAgo },
        };
      } else if (status === "inactive") {
        whereClause = {
          deletedAt: null,
          lastActivityAt: { lt: thirtyDaysAgo },
        };
      }

      if (search) {
        whereClause = {
          ...whereClause,
          name: { contains: search, mode: "insensitive" },
        };
      }

      const [guilds, total] = await Promise.all([
        ctx.db.guild.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            isActive: true,
            lastActivityAt: true,
            createdAt: true,
            deletedAt: true,
            _count: {
              select: {
                masters: true,
                players: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        ctx.db.guild.count({ where: whereClause }),
      ]);

      return {
        guilds,
        total,
        page,
        totalPages: Math.ceil(total / limit),
      };
    }),

  /**
   * Single guild detail by ID — for support requests.
   */
  guildDetail: adminProcedure
    .input(z.object({ guildId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const guild = await ctx.db.guild.findUnique({
        where: { id: input.guildId },
        select: {
          id: true,
          name: true,
          description: true,
          inviteCode: true,
          isActive: true,
          lastActivityAt: true,
          createdAt: true,
          deletedAt: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              masters: true,
              players: true,
              quests: true,
            },
          },
          masters: {
            select: {
              role: true,
              joinedAt: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });

      return guild;
    }),

  /**
   * List guilds inactive for more than 11 months (candidates for cleanup warning/deletion).
   */
  inactiveGuilds: adminProcedure.query(async ({ ctx }) => {
    const elevenMonthsAgo = new Date();
    elevenMonthsAgo.setMonth(elevenMonthsAgo.getMonth() - 11);

    const guilds = await ctx.db.guild.findMany({
      where: {
        deletedAt: null,
        lastActivityAt: { lte: elevenMonthsAgo },
      },
      select: {
        id: true,
        name: true,
        lastActivityAt: true,
        createdAt: true,
        _count: {
          select: { players: true },
        },
        masters: {
          where: { role: "owner" },
          select: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { lastActivityAt: "asc" },
    });

    return guilds;
  }),

  /**
   * Manually trigger the guild cleanup logic.
   * Mirrors the logic in /api/cron/guild-cleanup/route.ts.
   */
  triggerCleanup: adminProcedure.mutation(async ({ ctx }) => {
    const now = new Date();

    const elevenMonthsAgo = new Date(now);
    elevenMonthsAgo.setMonth(now.getMonth() - 11);

    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(now.getMonth() - 12);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const formatDate = (d: Date) =>
      d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

    // 1. Hard delete guilds soft-deleted more than 30 days ago
    const hardDeleteResult = await ctx.db.guild.deleteMany({
      where: {
        deletedAt: {
          not: null,
          lte: thirtyDaysAgo,
        },
      },
    });
    const hardDeleted = hardDeleteResult.count;

    // 2. Soft delete guilds inactive for more than 12 months
    const softDeleteResult = await ctx.db.guild.updateMany({
      where: {
        deletedAt: null,
        lastActivityAt: { lte: twelveMonthsAgo },
      },
      data: {
        deletedAt: now,
        isActive: false,
      },
    });
    const softDeleted = softDeleteResult.count;

    // 3. Warn guilds inactive for 11–12 months
    const guildsToWarn = await ctx.db.guild.findMany({
      where: {
        deletedAt: null,
        lastActivityAt: {
          lte: elevenMonthsAgo,
          gt: twelveMonthsAgo,
        },
      },
      include: {
        masters: {
          where: { role: "owner" },
          include: { user: { select: { id: true, email: true, name: true } } },
        },
      },
    });

    let warned = 0;

    for (const guild of guildsToWarn) {
      const owner = guild.masters[0]?.user;
      if (!owner) continue;

      const deletionDate = new Date(guild.lastActivityAt);
      deletionDate.setMonth(deletionDate.getMonth() + 12);

      const result = await sendEmail(
        owner.email,
        "guild_warning",
        {
          masterName: owner.name,
          guildName: guild.name,
          lastActivityAt: formatDate(guild.lastActivityAt),
          deletionDate: formatDate(deletionDate),
        },
        owner.id
      );

      if (result.success) {
        warned++;
      } else {
        console.error(
          `admin.triggerCleanup: failed to warn master ${owner.id} for guild ${guild.id}: ${result.error}`
        );
      }
    }

    return { warned, softDeleted, hardDeleted, timestamp: now.toISOString() };
  }),
});
