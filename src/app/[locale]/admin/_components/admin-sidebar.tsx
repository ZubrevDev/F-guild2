"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LayoutDashboard, Users2, Trash2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "overview", href: "/admin", icon: LayoutDashboard },
  { key: "guilds", href: "/admin/guilds", icon: Users2 },
  { key: "cleanup", href: "/admin/cleanup", icon: Trash2 },
] as const;

export default function AdminSidebar({ locale }: { locale: string }) {
  // locale prop reserved for future use (e.g. locale-aware links)
  void locale;
  const t = useTranslations("admin.nav");
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
      <div className="flex items-center gap-2 p-4">
        <Shield className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold text-primary">Admin</h2>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {navItems.map(({ key, href, icon: Icon }) => {
          const isActive =
            pathname === href ||
            (href !== "/admin" && pathname.startsWith(href));
          return (
            <Link
              key={key}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {t(key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
