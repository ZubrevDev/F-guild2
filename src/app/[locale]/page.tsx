import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function Home() {
  const t = useTranslations("home");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="absolute top-4 right-4">
        <LocaleSwitcher />
      </div>
      <h1 className="text-4xl font-bold text-primary">{t("title")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <Button>{t("getStarted")}</Button>
    </main>
  );
}
