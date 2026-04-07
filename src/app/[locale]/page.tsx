import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Sparkles } from "lucide-react";

const features = [
  { key: "quests", emoji: "⚔️" },
  { key: "characters", emoji: "🧙" },
  { key: "shop", emoji: "💎" },
  { key: "dice", emoji: "🎲" },
] as const;

const steps = [
  { key: "step1", emoji: "🏰" },
  { key: "step2", emoji: "📜" },
  { key: "step3", emoji: "🌟" },
] as const;

export default function Home() {
  const t = useTranslations("home");

  return (
    <div className="relative flex flex-col overflow-x-hidden">
      {/* Background atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-32 -left-32 h-80 w-80 rounded-full bg-accent/20 blur-3xl animate-glow-pulse delay-700" />
        <div className="absolute top-1/2 left-1/4 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-[15%] right-[20%] text-2xl animate-float opacity-20">✨</div>
        <div className="absolute top-[60%] left-[10%] text-xl animate-float delay-500 opacity-15">⭐</div>
        <div className="absolute top-[40%] right-[8%] text-lg animate-float delay-300 opacity-20">🌟</div>
      </div>

      {/* Locale switcher */}
      <div className="fixed top-4 right-4 z-50">
        <LocaleSwitcher />
      </div>

      {/* ═══════════ HERO ═══════════ */}
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-center px-4 text-center md:px-6">
        <div className="animate-float animate-fade-up mb-6">
          <div className="relative">
            <div className="flex h-28 w-28 items-center justify-center rounded-3xl border-2 border-border bg-card text-6xl shadow-2xl">
              🏰
            </div>
            <div className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow-lg animate-bounce">
              ✨
            </div>
          </div>
        </div>

        <h1 className="animate-fade-up delay-100 font-cinzel text-4xl font-black tracking-wider text-foreground md:text-6xl">
          F-GUILD
        </h1>

        <div className="animate-fade-up delay-200 my-4 flex items-center gap-3">
          <span className="h-px w-8 bg-gradient-to-r from-transparent to-primary/60" />
          <span className="text-xs font-cinzel tracking-[0.3em] uppercase text-muted-foreground">
            {t("subtitle")}
          </span>
          <span className="h-px w-8 bg-gradient-to-l from-transparent to-primary/60" />
        </div>

        <p className="animate-fade-up delay-300 max-w-sm text-sm leading-relaxed text-muted-foreground md:text-base">
          {t("description")}
        </p>

        <div className="animate-fade-up delay-400 mt-10 flex w-full max-w-xs flex-col gap-3">
          <Button
            asChild
            size="lg"
            className="group relative w-full overflow-hidden bg-primary text-base font-bold shadow-lg transition-all hover:bg-primary/90"
          >
            <Link href="/register">
              <Sparkles className="mr-2 size-5" />
              {t("getStarted")}
              <ArrowRight className="ml-2 size-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full backdrop-blur-sm">
            <Link href="/login">{t("login")}</Link>
          </Button>
          <Link
            href="/player-login"
            className="mt-1 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            {t("playerLogin")}
          </Link>
        </div>

        <div className="animate-fade-up delay-700 absolute bottom-8 flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40">scroll</span>
          <div className="h-8 w-5 rounded-full border border-border p-1">
            <div className="h-2 w-full rounded-full bg-primary/60 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ═══════════ FEATURES ═══════════ */}
      <section className="relative px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-lg">
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {features.map(({ key, emoji }) => (
              <div
                key={key}
                className="group relative rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:bg-accent md:p-5"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20 text-2xl">
                  {emoji}
                </div>
                <h3 className="font-cinzel text-sm font-bold tracking-wide text-foreground">
                  {t(`features.${key}`)}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {t(`features.${key}Desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS ═══════════ */}
      <section className="relative px-4 py-6 md:px-6 md:py-8">
        <div className="mx-auto max-w-lg">
          <h2 className="mb-12 text-center font-cinzel text-2xl font-bold tracking-wide text-foreground md:text-3xl">
            {t("howItWorks")}
          </h2>

          <div className="relative flex flex-col gap-6">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary/40 via-accent/40 to-primary/20" aria-hidden="true" />

            {steps.map(({ key, emoji }) => (
              <div key={key} className="relative flex items-start gap-5">
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card text-xl shadow-lg">
                  {emoji}
                </div>
                <div className="rounded-xl bg-card border border-border p-4 flex-1">
                  <h3 className="font-cinzel text-base font-bold tracking-wide text-foreground">
                    {t(key)}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {t(`${key}Desc`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ BOTTOM CTA ═══════════ */}
      <section className="relative px-4 pb-6 pt-8 text-center md:px-6 md:pb-8">
        <div className="mx-auto max-w-xs">
          <div className="mb-10 flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-primary/40" />
            <span className="text-3xl">🌟</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-primary/40" />
          </div>

          <Button
            asChild
            size="lg"
            className="w-full bg-primary text-base font-bold shadow-lg hover:bg-primary/90"
          >
            <Link href="/register">
              <Sparkles className="mr-2 size-5" />
              {t("getStarted")}
              <ArrowRight className="ml-2 size-5" />
            </Link>
          </Button>
          <p className="mt-5 text-sm text-muted-foreground">
            <Link href="/login" className="text-primary transition-colors hover:text-primary/80 hover:underline underline-offset-4">
              {t("login")}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
