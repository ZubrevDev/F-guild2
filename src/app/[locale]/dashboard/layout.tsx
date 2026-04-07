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
      <aside className="hidden w-56 shrink-0 border-r border-border bg-background md:flex md:flex-col">
        <div className="flex items-center gap-3 p-4 pb-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white shadow-lg">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-white leading-none">F-Guild</h2>
            {userName && (
              <p className="truncate text-[11px] text-muted-foreground mt-0.5">{userName}</p>
            )}
          </div>
          {session?.user?.id && (
            <NotificationBell recipientType="master" recipientId={session.user.id} />
          )}
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          {navItems.map(({ key, href, icon: Icon }) => {
            const isActive = isNavItemActive(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "sidebar-active-item text-white font-medium shadow-md"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
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
      <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6">{children}</main>

      {/* Mobile notification bell — fixed top-right */}
      {session?.user?.id && (
        <div className="fixed right-4 z-50 md:hidden app-header" style={{ top: 0 }}>
          <NotificationBell recipientType="master" recipientId={session.user.id} />
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background app-bottom-nav md:hidden">
        <div className="flex justify-around px-1">
          {navItems.slice(0, 5).map(({ key, href, icon: Icon }) => {
            const isActive = isNavItemActive(pathname, href);
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 min-h-[48px] min-w-[48px] px-1 py-1.5 text-[10px] transition-colors touch-active no-select",
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
