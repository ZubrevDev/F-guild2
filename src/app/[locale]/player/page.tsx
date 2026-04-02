"use client";

import { useTranslations } from "next-intl";
import { CharacterCard } from "@/components/player/character-card";

// TODO: Replace with real data from tRPC when player session is implemented
const MOCK_CHARACTER = {
  playerName: "Артас",
  character: {
    class: "fighter",
    level: 3,
    xp: 180,
    gold: 250,
    faithPoints: 15,
  },
};

export default function PlayerDashboard() {
  const t = useTranslations("player");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <CharacterCard
        playerName={MOCK_CHARACTER.playerName}
        character={MOCK_CHARACTER.character}
      />

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold">{t("activeQuests")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">{t("noQuests")}</p>
      </div>
    </div>
  );
}
