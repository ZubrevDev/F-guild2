"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

const localeNames: Record<string, string> = {
  en: "English",
  ru: "Русский",
  fr: "Français",
};

export default function SettingsPage() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function changeLocale(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("settings")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Language / Язык / Langue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            {routing.locales.map((loc) => (
              <button
                key={loc}
                onClick={() => changeLocale(loc)}
                className={`flex items-center gap-3 rounded-md px-4 py-3 text-left text-sm transition-colors ${
                  loc === locale
                    ? "bg-primary/10 text-primary font-medium ring-1 ring-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="text-lg">
                  {loc === "en" ? "🇬🇧" : loc === "ru" ? "🇷🇺" : "🇫🇷"}
                </span>
                <span>{localeNames[loc]}</span>
                {loc === locale && (
                  <span className="ml-auto text-xs text-primary">✓</span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
