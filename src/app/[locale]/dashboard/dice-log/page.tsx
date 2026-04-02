"use client";

import { useTranslations } from "next-intl";

export default function DiceLogPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("diceLog")}</h1>
    </div>
  );
}
