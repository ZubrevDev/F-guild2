"use client";

import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("settings")}</h1>
    </div>
  );
}
