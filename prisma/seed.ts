import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create a Game Master (User)
  const master = await prisma.user.upsert({
    where: { email: "gm@fguild.dev" },
    update: {},
    create: {
      email: "gm@fguild.dev",
      passwordHash: "$2b$10$placeholder_hash_for_seed_data",
      name: "Game Master",
      locale: "ru",
    },
  });

  // Create a Guild
  const guild = await prisma.guild.upsert({
    where: { inviteCode: "DEMO-GUILD-2026" },
    update: {},
    create: {
      name: "Дом Солнца",
      inviteCode: "DEMO-GUILD-2026",
      createdById: master.id,
    },
  });

  // Link master to guild as owner
  await prisma.guildMaster.upsert({
    where: {
      guildId_userId: { guildId: guild.id, userId: master.id },
    },
    update: {},
    create: {
      guildId: guild.id,
      userId: master.id,
      role: "owner",
    },
  });

  // Create a Player
  const player = await prisma.player.upsert({
    where: { guildId_name: { guildId: guild.id, name: "Артас" } },
    update: {},
    create: {
      guildId: guild.id,
      name: "Артас",
      pin: "$2b$10$placeholder_pin_hash",
      qrToken: "demo-qr-token-arthas-2026",
      authMethod: "pin",
    },
  });

  // Create Character for player
  await prisma.character.upsert({
    where: { playerId: player.id },
    update: {},
    create: {
      playerId: player.id,
      class: "fighter",
      level: 1,
      xp: 0,
      gold: 100,
      faithPoints: 10,
      stats: {
        strength: 14,
        dexterity: 12,
        intelligence: 10,
        wisdom: 10,
        charisma: 11,
      },
    },
  });

  // Create a Quest
  await prisma.quest.create({
    data: {
      guildId: guild.id,
      createdById: master.id,
      title: "Убрать комнату",
      description: "Навести порядок в своей комнате: убрать вещи, протереть пыль, пропылесосить.",
      type: "mandatory",
      recurrence: "daily",
      xpReward: 50,
      goldReward: 20,
      faithReward: 1,
      difficultyClass: 10,
      confirmationType: "photo",
    },
  });

  // Create an Item in shop
  await prisma.item.create({
    data: {
      guildId: guild.id,
      name: "Меч удачи +2",
      description: "Даёт +2 к броскам d20",
      category: "game_item",
      price: 200,
      effect: { type: "dice_bonus", value: 2 },
    },
  });

  // Create a Buff template
  await prisma.buff.create({
    data: {
      guildId: guild.id,
      name: "Благословление предка",
      type: "buff",
      effect: { type: "xp_bonus", value: 50 },
      durationType: "timed",
      defaultDurationMinutes: 60,
      description: "+50% к XP на 1 час",
      icon: "sparkles",
    },
  });

  console.log("Seed data created successfully!");
  console.log({ master: master.email, guild: guild.name, player: player.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
