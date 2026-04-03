/**
 * Email service layer using Resend.
 * Provides sendEmail() with template rendering, rate limiting,
 * and per-type toggle support.
 */

import { Resend } from "resend";
import {
  type EmailTemplateType,
  type EmailTemplateData,
  renderEmailTemplate,
} from "./email-templates";
import { checkRateLimit, type RateLimitConfig } from "./rate-limit";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const resend = new Resend(process.env.RESEND_API_KEY);

const EMAIL_FROM =
  process.env.EMAIL_FROM ?? "Guild <noreply@guild.example.com>";

/** Rate limit: 10 emails per hour per user */
const EMAIL_RATE_LIMIT: RateLimitConfig = {
  max: 10,
  windowMs: 60 * 60 * 1000, // 1 hour
};

/**
 * Env-driven toggles for each email type.
 * Set EMAIL_DISABLE_<TYPE>=true to disable (e.g. EMAIL_DISABLE_WELCOME=true).
 * All types are enabled by default.
 */
function isEmailTypeEnabled(type: EmailTemplateType): boolean {
  const envKey = `EMAIL_DISABLE_${type.toUpperCase()}`;
  return process.env[envKey] !== "true";
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type SendEmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

/**
 * Send a transactional email.
 *
 * @param to      - Recipient email address
 * @param template - Template type (welcome, quest_completed, level_up, prayer_answer)
 * @param data    - Template-specific data
 * @param userId  - Used as rate-limit key (user ID or email)
 */
export async function sendEmail<T extends EmailTemplateType>(
  to: string,
  template: T,
  data: EmailTemplateData[T],
  userId: string
): Promise<SendEmailResult> {
  // 1. Check toggle
  if (!isEmailTypeEnabled(template)) {
    return { success: false, error: `Email type "${template}" is disabled` };
  }

  // 2. Rate limit
  const rateLimitKey = `email:${userId}`;
  const rateCheck = checkRateLimit(rateLimitKey, EMAIL_RATE_LIMIT);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Retry after ${Math.ceil((rateCheck.retryAfterMs ?? 0) / 1000)}s`,
    };
  }

  // 3. Render template
  const { subject, html } = renderEmailTemplate(template, data);

  // 4. Send via Resend
  try {
    const response = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject,
      html,
    });

    if (response.error) {
      return {
        success: false,
        error: response.error.message ?? "Unknown Resend error",
      };
    }

    return { success: true, id: response.data?.id ?? "unknown" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
