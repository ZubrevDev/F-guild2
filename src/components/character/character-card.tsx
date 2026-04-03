"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const CLASS_EMOJIS: Record<string, string> = {
  fighter: "⚔️",
  wizard: "🪄",
  ranger: "🌲",
  cleric: "✝️",
  rogue: "👁️",
  bard: "🎵",
};

interface CharacterCardProps {
  character: {
    class: string;
    level: number;
    xp: number;
    gold: number;
    faithPoints: number;
    strength: number;
    dexterity: number;
    intelligence: number;
    wisdom: number;
    charisma: number;
  };
  playerName: string;
}

export function CharacterCard({ character, playerName }: CharacterCardProps) {
  const t = useTranslations("character");

  const requiredXp = Math.floor(100 * character.level * 1.5);
  const xpPercent = Math.min(100, Math.round((character.xp / requiredXp) * 100));
  const classEmoji = CLASS_EMOJIS[character.class] ?? "🎲";

  const className =
    character.class in CLASS_EMOJIS
      ? t(character.class as "fighter" | "wizard" | "ranger" | "cleric" | "rogue" | "bard")
      : character.class;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base truncate">{playerName}</CardTitle>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <span aria-hidden="true">{classEmoji}</span>
          <span className="capitalize">{className}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-0">
        {/* Level */}
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-bold leading-none">{character.level}</span>
          <span className="text-xs text-muted-foreground">{t("level")}</span>
        </div>

        {/* XP progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("xp")}</span>
            <span>
              {character.xp} / {requiredXp}
            </span>
          </div>
          <Progress value={xpPercent} />
        </div>

        {/* Gold + Faith */}
        <div className="flex gap-4 text-sm">
          <span>
            <span aria-hidden="true">🪙 </span>
            <span className="font-medium">{character.gold}</span>{" "}
            <span className="text-xs text-muted-foreground">{t("gold")}</span>
          </span>
          <span>
            <span aria-hidden="true">🙏 </span>
            <span className="font-medium">{character.faithPoints}</span>{" "}
            <span className="text-xs text-muted-foreground">{t("faith")}</span>
          </span>
        </div>

        {/* Stats row */}
        <div className="flex justify-between rounded-md border border-input bg-muted/40 px-2 py-1.5 text-center text-xs">
          {(
            [
              ["strength", t("strength")],
              ["dexterity", t("dexterity")],
              ["intelligence", t("intelligence")],
              ["wisdom", t("wisdom")],
              ["charisma", t("charisma")],
            ] as [keyof CharacterCardProps["character"], string][]
          ).map(([stat, label]) => (
            <div key={stat} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-muted-foreground">{label}</span>
              <span className="font-semibold">{character[stat]}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
