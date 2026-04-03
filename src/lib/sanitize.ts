/**
 * Input sanitization utilities.
 * Strips HTML tags and dangerous patterns from string inputs.
 * No external dependencies — uses regex-based approach.
 */

/**
 * Strip all HTML tags from a string.
 * Also removes event handlers and javascript: URLs that might slip through.
 */
export function stripHtml(input: string): string {
  return input
    // Remove HTML tags
    .replace(/<[^>]*>/g, "")
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, "")
    // Remove data: URIs that could contain scripts
    .replace(/data\s*:\s*text\/html/gi, "")
    // Remove event handler patterns (onerror=, onclick=, etc.)
    .replace(/\bon\w+\s*=/gi, "")
    // Normalize whitespace that might have been left from stripped tags
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Recursively sanitize all string values in an object/array.
 * Non-string values are left unchanged.
 */
export function sanitizeInput<T>(input: T): T {
  if (typeof input === "string") {
    return stripHtml(input) as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => sanitizeInput(item)) as T;
  }

  if (input !== null && typeof input === "object" && !(input instanceof Date)) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized as T;
  }

  return input;
}
