"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LayoutDashboard, Sword, User, ShoppingBag, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlayerSession } from "@/lib/player-session";
import { NotificationBell } from "@/components/notifications/notification-bell";

const navItems = [
  { key: "home", href: "/player", icon: LayoutDashboard },
  { key: "quests", href: "/player/quests", icon: Sword },
  { key: "character", href: "/player/character", icon: User },
  { key: "shop", href: "/player/shop", icon: ShoppingBag },
  { key: "prayers", href: "/player/prayers", icon: MessageCircle },
] as const;

export default function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { session } = usePlayerSession();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r border-border bg-background md:flex md:flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">{session?.playerName}</span>
          {session?.playerId && (
            <NotificationBell recipientType="player" recipientId={session.playerId} />
          )}
        </div>
        <nav className="flex flex-col gap-0.5 px-3 pt-4">
          {navItems.map(({ key, href, icon: Icon }) => {
            const isActive =
              href === "/player"
                ? pathname === "/player"
                : pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200",
                  isActive
                    ? "sidebar-active-item text-white font-medium shadow-md"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {t(key)}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 pt-16 pb-24 md:p-6 md:pt-6 md:pb-6">{children}</main>

      {/* Mobile top bar with notifications */}
      {session?.playerId && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 border-b border-border bg-background app-header md:hidden">
          <span className="text-sm font-medium text-foreground">{session.playerName}</span>
          <NotificationBell recipientType="player" recipientId={session.playerId} />
        </div>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background app-bottom-nav md:hidden">
        <div className="flex justify-around px-1">
          {navItems.map(({ key, href, icon: Icon }) => {
            const isActive =
              href === "/player"
                ? pathname === "/player"
                : pathname === href || pathname.startsWith(href + "/");
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
