"use client";

import { useTranslations } from "next-intl";

export default function ShopPage() {
  const t = useTranslations("nav");
  return (
    <div>
      <h1 className="text-2xl font-bold">{t("shop")}</h1>
    </div>
  );
}
