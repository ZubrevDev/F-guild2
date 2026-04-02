"use client";

import { useTranslations } from "next-intl";

export default function BuffsPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("buffs")}</h1>
    </div>
  );
}
