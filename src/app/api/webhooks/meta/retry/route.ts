import { NextRequest, NextResponse } from "next/server";
import { retryDueFailures } from "@/lib/meta/process-lead";

// Re-processes Meta leads that previously failed (e.g. transient Graph API
// errors or an expired token that has since been refreshed).
//
// Protect this endpoint with a shared secret so it can't be triggered publicly.
// Configure a scheduled trigger to hit it — e.g. a Vercel Cron entry in
// vercel.json pointing at /api/webhooks/meta/retry with the CRON_SECRET, or an
// external scheduler sending `Authorization: Bearer <CRON_SECRET>`.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const result = await retryDueFailures();
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error("[Meta Webhook Retry] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Allow GET too so platform cron schedulers that only issue GET can trigger it.
export async function GET(req: NextRequest) {
  return POST(req);
}
