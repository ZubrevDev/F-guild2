"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useTranslations } from "next-intl";
import { Coins, Sparkles, Shield, Sword, Wand2, TreePine, Cross, Eye, Music } from "lucide-react";

const CLASS_ICONS: Record<string, typeof Shield> = {
  fighter: Sword,
  wizard: Wand2,
  ranger: TreePine,
  cleric: Cross,
  rogue: Eye,
  bard: Music,
};

function xpForLevel(level: number): number {
  return level * 100;
}

interface CharacterCardProps {
  playerName: string;
  character: {
    class: string;
    level: number;
    xp: number;
    gold: number;
    faithPoints: number;
  };
}

export function CharacterCard({ playerName, character }: CharacterCardProps) {
  const t = useTranslations("player");
  const ClassIcon = CLASS_ICONS[character.class] || Shield;
  const xpNeeded = xpForLevel(character.level);
  const xpPercent = Math.min((character.xp / xpNeeded) * 100, 100);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
            <ClassIcon className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{playerName}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {character.class}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {t("level")} {character.level}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>XP</span>
            <span>
              {character.xp} / {xpNeeded}
            </span>
          </div>
          <Progress value={xpPercent} className="h-2" />
        </div>

        <div className="mt-4 flex gap-4">
          <div className="flex items-center gap-1.5">
            <Coins className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-medium">{character.gold}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">{character.faithPoints}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
