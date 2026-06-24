// Server-only environment validation.
// Import this in server code (route handlers, server actions) to fail fast
// with a clear message when a required variable is missing, instead of
// surfacing cryptic runtime errors deep in a request.
//
// NOTE: Do NOT import this in client components — it references server-only
// secrets that must never be sent to the browser.

type EnvKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "META_VERIFY_TOKEN"
  | "META_APP_SECRET"
  | "RESEND_API_KEY"
  | "RESEND_FROM_EMAIL"
  | "RESEND_DEFAULT_FROM"
  | "RESEND_INBOUND_DOMAIN"
  | "RESEND_WEBHOOK_SECRET"
  | "CRON_SECRET"
  | "NEXT_PUBLIC_APP_URL";

// Variables that must always be present for the app to function.
const REQUIRED: EnvKey[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function read(key: EnvKey, { required }: { required: boolean }): string {
  const value = process.env[key];
  if (required && (!value || value.trim() === "")) {
    throw new Error(
      `[env] Missing required environment variable: ${key}. ` +
        `Set it in .env.local (local) or your hosting provider's env settings.`
    );
  }
  return value ?? "";
}

// Validate required vars once at module load (server boot / first import).
for (const key of REQUIRED) {
  read(key, { required: true });
}

export const env = {
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL", { required: true }),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY", { required: true }),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY", { required: true }),

  // Meta integration — only required for the webhook path, so read lazily.
  metaVerifyToken: read("META_VERIFY_TOKEN", { required: false }),
  metaAppSecret: read("META_APP_SECRET", { required: false }),

  // Email — optional; features degrade gracefully if absent.
  resendApiKey: read("RESEND_API_KEY", { required: false }),
  resendFromEmail: read("RESEND_FROM_EMAIL", { required: false }),
  resendDefaultFrom: read("RESEND_DEFAULT_FROM", { required: false }),
  resendInboundDomain: read("RESEND_INBOUND_DOMAIN", { required: false }),
  resendWebhookSecret: read("RESEND_WEBHOOK_SECRET", { required: false }),

  appUrl: read("NEXT_PUBLIC_APP_URL", { required: false }) || "http://localhost:3000",
} as const;

// Throw with a clear message if Meta webhook env is incomplete at the point
// of use (call this inside the webhook handler, not at module load).
export function assertMetaEnv(): { verifyToken: string; appSecret: string } {
  if (!env.metaVerifyToken) {
    throw new Error("[env] META_VERIFY_TOKEN is not set — Meta webhook cannot verify subscriptions.");
  }
  if (!env.metaAppSecret) {
    throw new Error("[env] META_APP_SECRET is not set — Meta webhook cannot verify payload signatures.");
  }
  return { verifyToken: env.metaVerifyToken, appSecret: env.metaAppSecret };
}
