import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { Sword, Users, ShoppingBag, Dice5, ArrowRight } from "lucide-react";

const features = [
  { key: "quests", icon: Sword, color: "text-purple-400" },
  { key: "characters", icon: Users, color: "text-xp" },
  { key: "shop", icon: ShoppingBag, color: "text-gold" },
  { key: "dice", icon: Dice5, color: "text-mana-blue" },
] as const;

const steps = [
  { key: "step1", emoji: "🏰" },
  { key: "step2", emoji: "📜" },
  { key: "step3", emoji: "⚔️" },
] as const;

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="flex flex-col">
      {/* Locale switcher */}
      <div className="fixed top-4 right-4 z-50">
        <LocaleSwitcher />
      </div>

      {/* Hero Section */}
      <section className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
        {/* D20 Icon */}
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 text-4xl shadow-lg shadow-purple-500/25">
          🎲
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-foreground md:text-5xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-lg font-medium text-primary md:text-xl">
          {t("subtitle")}
        </p>
        <p className="mt-4 max-w-md text-muted-foreground">
          {t("description")}
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <Button asChild size="lg" className="w-full gradient-btn-primary border-0 text-base font-semibold shadow-lg shadow-purple-500/20">
            <Link href="/register">
              {t("getStarted")}
              <ArrowRight className="ml-2 size-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Link
            href="/player-login"
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            {t("playerLogin")}
          </Link>
        </div>

        {/* Scroll hint */}
        <div className="mt-12 animate-bounce text-muted-foreground/50">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mx-auto">
            <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-lg">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {features.map(({ key, icon: Icon, color }) => (
              <div
                key={key}
                className="gradient-card rounded-xl p-4 md:p-5 transition-all hover:border-purple-500/40"
              >
                <Icon className={`size-7 ${color} mb-3`} />
                <h3 className="text-sm font-semibold text-foreground">
                  {t(`features.${key}`)}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {t(`features.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="px-6 py-16 md:py-24">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-8 text-center text-2xl font-bold text-foreground md:text-3xl">
            {t("howItWorks")}
          </h2>
          <div className="flex flex-col gap-6">
            {steps.map(({ key, emoji }) => (
              <div key={key} className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-xl font-bold text-white shadow-md shadow-purple-500/20">
                  {emoji}
                </div>
                <div className="pt-1">
                  <h3 className="text-base font-semibold text-foreground">
                    {t(key)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    {t(`${key}Desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-16 pt-8 text-center md:pb-24">
        <div className="mx-auto max-w-xs">
          <Button asChild size="lg" className="w-full gradient-btn-primary border-0 text-base font-semibold shadow-lg shadow-purple-500/20">
            <Link href="/register">
              {t("getStarted")}
              <ArrowRight className="ml-2 size-5" />
            </Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/login" className="text-primary hover:underline">
              {t("login")}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
