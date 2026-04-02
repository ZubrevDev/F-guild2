"use client";

import { useTranslations } from "next-intl";

export default function PlayersPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("players")}</h1>
    </div>
  );
}
