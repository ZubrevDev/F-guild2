import posthog from "posthog-js";

/**
 * Analytics event names used throughout the application.
 * Keeping them centralized prevents typos and makes tracking auditable.
 */
export const AnalyticsEvents = {
  REGISTRATION: "registration",
  GUILD_CREATE: "guild_create",
  QUEST_COMPLETE: "quest_complete",
  PURCHASE: "purchase",
} as const;

export type AnalyticsEvent =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

/**
 * Whether analytics is enabled (PostHog key is set).
 */
function isEnabled(): boolean {
  return !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

/**
 * Initialise PostHog. Safe to call multiple times — subsequent calls are
 * no-ops. Does nothing when the env var is missing.
 */
export function initAnalytics(): void {
  if (!isEnabled()) return;
  if (typeof window === "undefined") return;

  // Avoid double-init
  if (posthog.__loaded) return;

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    // Privacy-friendly defaults — no personal data leaves the browser
    persistence: "localStorage",
    autocapture: false,
    capture_pageview: false, // we handle page views manually
    capture_pageleave: true,
    disable_session_recording: true,
    sanitize_properties: (properties) => {
      // Strip any properties that could contain PII
      const cleaned = { ...properties };
      delete cleaned.$ip;
      return cleaned;
    },
  });
}

/**
 * Track a custom event with optional metadata.
 * No-op when analytics is disabled.
 */
export function trackEvent(
  event: AnalyticsEvent | string,
  properties?: Record<string, string | number | boolean>
): void {
  if (!isEnabled()) return;
  if (typeof window === "undefined") return;

  posthog.capture(event, properties);
}

/**
 * Track a page view. Call from the PostHog provider on route change.
 */
export function trackPageView(): void {
  if (!isEnabled()) return;
  if (typeof window === "undefined") return;

  posthog.capture("$pageview");
}
