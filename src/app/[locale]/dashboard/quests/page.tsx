"use client";

import { useTranslations } from "next-intl";

export default function QuestsPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("quests")}</h1>
    </div>
  );
}
