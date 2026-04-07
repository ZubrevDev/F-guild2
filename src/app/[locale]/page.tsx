import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Link } from "@/i18n/navigation";

export default function Home() {
  const t = useTranslations("home");

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <h1 className="text-3xl md:text-4xl font-bold text-primary text-center">{t("title")}</h1>
      <p className="text-muted-foreground text-center max-w-sm">{t("description")}</p>
      <Button asChild size="lg" className="w-full max-w-xs">
        <Link href="/register">{t("getStarted")}</Link>
      </Button>
    </main>
  );
}
