"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Sword, User, ShoppingBag, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { key: "quests", href: "/player", icon: Sword },
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

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1 p-4 pb-20 lg:pb-4">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card lg:static lg:border-t-0 lg:border-r lg:order-first lg:w-56">
        <div className="flex justify-around lg:flex-col lg:gap-1 lg:p-4">
          {navItems.map(({ key, href, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/player" && pathname.startsWith(href));
            return (
              <Link
                key={key}
                href={href}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 text-xs lg:flex-row lg:gap-3 lg:rounded-md lg:px-4 lg:py-2.5 lg:text-sm",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
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
