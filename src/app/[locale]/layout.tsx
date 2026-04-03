import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { TRPCProvider } from "@/components/providers";
import { RegisterSW } from "@/components/pwa/register-sw";
import "../globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "F-Guild",
  description: "Family gamification platform with DnD mechanics",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "F-Guild",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className={inter.className}>
        <NextIntlClientProvider messages={messages}>
          <TRPCProvider>{children}</TRPCProvider>
        </NextIntlClientProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
