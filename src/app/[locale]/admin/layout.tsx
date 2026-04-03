/**
 * Admin layout — server component.
 * Checks session and isPlatformAdmin before rendering.
 * Redirects to /dashboard if not authorized.
 */

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/server/db";
import AdminSidebar from "./_components/admin-sidebar";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isPlatformAdmin: true },
  });

  if (!user?.isPlatformAdmin) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar locale={locale} />
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
