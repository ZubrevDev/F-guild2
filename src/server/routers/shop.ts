import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure, publicProcedure } from "../trpc";

const MAX_INVENTORY_SLOTS = 20;

export const shopRouter = router({
  createItem: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        name: z.string().min(1).max(200),
        description: z.string().min(1).max(2000),
        category: z.enum(["real_reward", "game_item"]),
        price: z.number().int().min(0),
        stock: z.number().int().min(0).nullable().default(null),
        levelRequired: z.number().int().min(1).default(1),
        classRequired: z
          .enum(["fighter", "wizard", "ranger", "cleric", "rogue", "bard"])
          .nullable()
          .default(null),
        effect: z.record(z.string(), z.unknown()).nullable().default(null),
        equipSlot: z
          .enum(["head", "body", "weapon", "shield", "gloves", "boots", "accessory"])
          .nullable()
          .default(null),
        rarity: z
          .enum(["common", "uncommon", "rare", "epic", "legendary"])
          .default("common"),
        imageUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      return ctx.db.item.create({
        data: {
          guildId: input.guildId,
          name: input.name,
          description: input.description,
          category: input.category,
          price: input.price,
          stock: input.stock,
          levelRequired: input.levelRequired,
          classRequired: input.classRequired,
          effect: (input.effect as Prisma.InputJsonValue) ?? undefined,
          equipSlot: input.equipSlot,
          rarity: input.rarity,
          imageUrl: input.imageUrl ?? null,
        },
      });
    }),

  listItems: protectedProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        category: z.enum(["real_reward", "game_item"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertGuildMaster(ctx, input.guildId);

      const where: Record<string, unknown> = { guildId: input.guildId };
      if (input.category) where.category = input.category;
      if (input.isActive !== undefined) where.isActive = input.isActive;

      return ctx.db.item.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  getItem: publicProcedure
    .input(z.object({ itemId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const item = await ctx.db.item.findUnique({
        where: { id: input.itemId },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      return item;
    }),

  updateItem: protectedProcedure
    .input(
      z.object({
        itemId: z.uuid(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().min(1).max(2000).optional(),
        category: z.enum(["real_reward", "game_item"]).optional(),
        price: z.number().int().min(0).optional(),
        stock: z.number().int().min(0).nullable().optional(),
        levelRequired: z.number().int().min(1).optional(),
        classRequired: z
          .enum(["fighter", "wizard", "ranger", "cleric", "rogue", "bard"])
          .nullable()
          .optional(),
        effect: z.record(z.string(), z.unknown()).nullable().optional(),
        equipSlot: z
          .enum(["head", "body", "weapon", "shield", "gloves", "boots", "accessory"])
          .nullable()
          .optional(),
        rarity: z
          .enum(["common", "uncommon", "rare", "epic", "legendary"])
          .optional(),
        imageUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.item.findUnique({
        where: { id: input.itemId },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      await assertGuildMaster(ctx, item.guildId);

      const { itemId, ...data } = input;
      const updateData: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(data)) {
        if (value !== undefined) {
          updateData[key] = value;
        }
      }

      return ctx.db.item.update({
        where: { id: itemId },
        data: updateData,
      });
    }),

  deactivateItem: protectedProcedure
    .input(z.object({ itemId: z.uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.item.findUnique({
        where: { id: input.itemId },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      await assertGuildMaster(ctx, item.guildId);

      return ctx.db.item.update({
        where: { id: input.itemId },
        data: { isActive: false },
      });
    }),

  playerItems: publicProcedure
    .input(
      z.object({
        guildId: z.uuid(),
        playerId: z.uuid(),
        category: z.enum(["real_reward", "game_item"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertPlayerInGuild(ctx, input.playerId, input.guildId);

      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });

      const where: Record<string, unknown> = {
        guildId: input.guildId,
        isActive: true,
      };
      if (input.category) where.category = input.category;

      // Filter by level/class eligibility if player has a character
      if (player?.character) {
        where.levelRequired = { lte: player.character.level };
        where.OR = [
          { classRequired: null },
          { classRequired: player.character.class },
        ];
      }

      return ctx.db.item.findMany({
        where,
        orderBy: { createdAt: "desc" },
      });
    }),

  purchase: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
        itemId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.item.findUnique({
        where: { id: input.itemId },
      });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Item not found" });
      }
      if (!item.isActive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item is no longer available",
        });
      }

      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found",
        });
      }
      if (player.guildId !== item.guildId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Player does not belong to this guild",
        });
      }
      if (!player.character) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Player has no character",
        });
      }

      const character = player.character;

      if (character.level < item.levelRequired) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Requires level ${item.levelRequired}`,
        });
      }
      if (item.classRequired && item.classRequired !== character.class) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Requires class ${item.classRequired}`,
        });
      }
      if (character.gold < item.price) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Insufficient gold",
        });
      }
      if (item.stock !== null && item.stock <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Item is out of stock",
        });
      }

      const currentInventory = await ctx.db.inventory.aggregate({
        where: { characterId: character.id },
        _sum: { quantity: true },
      });
      const usedSlots = currentInventory._sum.quantity ?? 0;
      if (usedSlots >= MAX_INVENTORY_SLOTS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Inventory full (${MAX_INVENTORY_SLOTS}/${MAX_INVENTORY_SLOTS} slots)`,
        });
      }

      return ctx.db.$transaction(async (tx) => {
        await tx.character.update({
          where: { id: character.id },
          data: { gold: { decrement: item.price } },
        });

        if (item.stock !== null) {
          await tx.item.update({
            where: { id: item.id },
            data: { stock: { decrement: 1 } },
          });
        }

        const inventoryItem = await tx.inventory.create({
          data: {
            characterId: character.id,
            itemId: item.id,
          },
          include: { item: true },
        });

        return inventoryItem;
      });
    }),

  inventory: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found",
        });
      }
      if (!player.character) {
        return [];
      }

      return ctx.db.inventory.findMany({
        where: { characterId: player.character.id },
        include: { item: true },
        orderBy: { acquiredAt: "desc" },
      });
    }),

  playerInventory: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found",
        });
      }
      if (!player.character) {
        return { items: [], totalSlots: MAX_INVENTORY_SLOTS, usedSlots: 0, equippedEffects: {} };
      }

      const items = await ctx.db.inventory.findMany({
        where: { characterId: player.character.id },
        include: { item: true },
        orderBy: [{ isEquipped: "desc" }, { acquiredAt: "desc" }],
      });

      const usedSlots = items.reduce((sum, inv) => sum + inv.quantity, 0);

      const equippedEffects: Record<string, number> = {};
      for (const inv of items) {
        if (inv.isEquipped && inv.item.effect) {
          const effect = inv.item.effect as Record<string, unknown>;
          for (const [key, value] of Object.entries(effect)) {
            if (typeof value === "number") {
              equippedEffects[key] = (equippedEffects[key] ?? 0) + value;
            }
          }
        }
      }

      return {
        items,
        totalSlots: MAX_INVENTORY_SLOTS,
        usedSlots,
        equippedEffects,
      };
    }),

  equippedItems: publicProcedure
    .input(z.object({ playerId: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player?.character) return {};

      const equipped = await ctx.db.inventory.findMany({
        where: { characterId: player.character.id, isEquipped: true },
        include: { item: true },
      });

      const slotMap: Record<string, typeof equipped[number]> = {};
      for (const inv of equipped) {
        if (inv.equipSlot) {
          slotMap[inv.equipSlot] = inv;
        }
      }
      return slotMap;
    }),

  equip: publicProcedure
    .input(
      z.object({
        inventoryItemId: z.uuid(),
        playerId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found",
        });
      }
      if (!player.character) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Player has no character",
        });
      }

      const inventoryItem = await ctx.db.inventory.findUnique({
        where: { id: input.inventoryItemId },
        include: { item: true },
      });
      if (!inventoryItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventory item not found",
        });
      }
      if (inventoryItem.characterId !== player.character.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Item does not belong to this player",
        });
      }

      if (inventoryItem.item.category !== "game_item") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only game items can be equipped",
        });
      }

      const item = inventoryItem.item;
      if (!item.equipSlot) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This item cannot be equipped (no slot defined)",
        });
      }

      // If already equipped in this slot — unequip
      if (inventoryItem.isEquipped && inventoryItem.equipSlot === item.equipSlot) {
        return ctx.db.inventory.update({
          where: { id: input.inventoryItemId },
          data: { isEquipped: false, equipSlot: null },
          include: { item: true },
        });
      }

      // Unequip any item currently in this slot, then equip the new one
      return ctx.db.$transaction(async (tx) => {
        await tx.inventory.updateMany({
          where: {
            characterId: player.character!.id,
            equipSlot: item.equipSlot,
            isEquipped: true,
          },
          data: { isEquipped: false, equipSlot: null },
        });

        return tx.inventory.update({
          where: { id: input.inventoryItemId },
          data: { isEquipped: true, equipSlot: item.equipSlot },
          include: { item: true },
        });
      });
    }),

  useItem: publicProcedure
    .input(
      z.object({
        inventoryItemId: z.uuid(),
        playerId: z.uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found",
        });
      }
      if (!player.character) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Player has no character",
        });
      }

      const inventoryItem = await ctx.db.inventory.findUnique({
        where: { id: input.inventoryItemId },
        include: { item: true },
      });
      if (!inventoryItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Inventory item not found",
        });
      }
      if (inventoryItem.characterId !== player.character.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Item does not belong to this player",
        });
      }

      const effect = (inventoryItem.item.effect as Record<string, unknown>) ?? {};
      if (!effect.consumable) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This item is not consumable",
        });
      }

      return ctx.db.$transaction(async (tx) => {
        const character = player.character!;
        const updateData: Record<string, unknown> = {};

        if (typeof effect.xp_bonus === "number") {
          updateData.xp = { increment: effect.xp_bonus };
        }
        if (typeof effect.gold_bonus === "number") {
          updateData.gold = { increment: effect.gold_bonus };
        }
        if (typeof effect.faith_bonus === "number") {
          updateData.faithPoints = { increment: effect.faith_bonus };
        }

        if (Object.keys(updateData).length > 0) {
          await tx.character.update({
            where: { id: character.id },
            data: updateData,
          });
        }

        if (inventoryItem.quantity > 1) {
          await tx.inventory.update({
            where: { id: inventoryItem.id },
            data: { quantity: { decrement: 1 } },
          });
        } else {
          await tx.inventory.delete({
            where: { id: inventoryItem.id },
          });
        }

        return {
          used: true,
          itemName: inventoryItem.item.name,
          effectApplied: effect,
          remainingQuantity: inventoryItem.quantity - 1,
        };
      });
    }),

  purchaseHistory: publicProcedure
    .input(
      z.object({
        playerId: z.uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const player = await ctx.db.player.findUnique({
        where: { id: input.playerId },
        include: { character: true },
      });
      if (!player) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Player not found",
        });
      }
      if (!player.character) {
        return [];
      }

      return ctx.db.inventory.findMany({
        where: { characterId: player.character.id },
        include: {
          item: {
            select: {
              id: true,
              name: true,
              description: true,
              category: true,
              price: true,
              imageUrl: true,
            },
          },
        },
        orderBy: { acquiredAt: "desc" },
      });
    }),
});

async function assertGuildMaster(
  ctx: {
    db: typeof import("../db").db;
    session: { userId: string; role: string };
  },
  guildId: string
) {
  const membership = await ctx.db.guildMaster.findUnique({
    where: { guildId_userId: { guildId, userId: ctx.session.userId } },
  });
  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Not a master of this guild",
    });
  }
  return membership;
}

async function assertPlayerInGuild(
  ctx: { db: typeof import("../db").db },
  playerId: string,
  guildId: string
) {
  const player = await ctx.db.player.findUnique({
    where: { id: playerId },
  });
  if (!player || player.guildId !== guildId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Player does not belong to this guild",
    });
  }
  return player;
}
