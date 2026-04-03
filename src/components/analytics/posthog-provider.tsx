"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { initAnalytics, trackPageView } from "@/lib/analytics";

/**
 * Client component that boots PostHog and tracks page views on route changes.
 * Renders nothing visible — safe to place anywhere in the component tree.
 *
 * If NEXT_PUBLIC_POSTHOG_KEY is not set the component is effectively a no-op.
 */
export function PostHogProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialise once on mount
  useEffect(() => {
    initAnalytics();
  }, []);

  // Track page view on every route change
  useEffect(() => {
    trackPageView();
  }, [pathname, searchParams]);

  return null;
}
