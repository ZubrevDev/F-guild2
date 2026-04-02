"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Sword,
  Users,
  ShoppingBag,
  Shield,
  MessageCircle,
  Dice5,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "overview", href: "/dashboard", icon: LayoutDashboard },
  { key: "quests", href: "/dashboard/quests", icon: Sword },
  { key: "players", href: "/dashboard/players", icon: Users },
  { key: "shop", href: "/dashboard/shop", icon: ShoppingBag },
  { key: "buffs", href: "/dashboard/buffs", icon: Shield },
  { key: "prayers", href: "/dashboard/prayers", icon: MessageCircle },
  { key: "diceLog", href: "/dashboard/dice-log", icon: Dice5 },
  { key: "settings", href: "/dashboard/settings", icon: Settings },
] as const;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:block">
        <div className="p-4">
          <h2 className="text-lg font-bold text-primary">F-Guild</h2>
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map(({ key, href, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
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

      {/* Main content */}
      <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map(({ key, href, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-2 text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{t(key)}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
