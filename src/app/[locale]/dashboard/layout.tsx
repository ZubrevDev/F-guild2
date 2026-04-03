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
import { LocaleSwitcher } from "@/components/locale-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useSession } from "next-auth/react";

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

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard";
  }
  return pathname === href || pathname.startsWith(href + "/");
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { data: session } = useSession();

  const userName = session?.user?.name;
  const userInitials = getInitials(userName);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex items-center gap-3 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-primary leading-none">F-Guild</h2>
            {userName && (
              <p className="truncate text-xs text-muted-foreground">{userName}</p>
            )}
          </div>
          {session?.user?.id && (
            <NotificationBell userId={session.user.id} />
          )}
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {navItems.map(({ key, href, icon: Icon }) => {
            const isActive = isNavItemActive(pathname, href);
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
        <div className="mt-auto border-t border-border p-4">
          <LocaleSwitcher />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 pb-20 md:p-6 md:pb-6">{children}</main>

      {/* Mobile notification bell — fixed top-right */}
      {session?.user?.id && (
        <div className="fixed right-4 top-3 z-50 md:hidden">
          <NotificationBell userId={session.user.id} />
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
        <div className="flex justify-around">
          {navItems.slice(0, 5).map(({ key, href, icon: Icon }) => {
            const isActive = isNavItemActive(pathname, href);
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
