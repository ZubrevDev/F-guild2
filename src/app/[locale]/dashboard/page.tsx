import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const t = await getTranslations("dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {t("welcome", { name: session.user.name ?? session.user.email ?? "" })}
        </p>
      </div>
    </div>
  );
}
