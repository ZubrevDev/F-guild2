"use client";

import { useTranslations } from "next-intl";

export default function PrayersPage() {
  const t = useTranslations("nav");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">{t("prayers")}</h1>
    </div>
  );
}
