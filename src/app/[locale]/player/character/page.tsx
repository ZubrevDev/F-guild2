"use client";

import { useTranslations } from "next-intl";

export default function CharacterPage() {
  const t = useTranslations("nav");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold">{t("character")}</h1>
    </div>
  );
}
