export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/health - Health check endpoint for monitoring
 */
export async function GET() {
  const start = Date.now();
  const checks: Record<string, { status: string; latency_ms?: number }> = {};

  // 1. Database check
  try {
    const dbStart = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").select("id").limit(1);
    checks.database = {
      status: error ? "degraded" : "healthy",
      latency_ms: Date.now() - dbStart,
    };
  } catch {
    checks.database = { status: "unhealthy" };
  }

  // 2. Auth check
  try {
    const authStart = Date.now();
    const supabase = await createClient();
    const { error } = await supabase.auth.getSession();
    checks.auth = {
      status: error ? "degraded" : "healthy",
      latency_ms: Date.now() - authStart,
    };
  } catch {
    checks.auth = { status: "unhealthy" };
  }

  // Overall status
  const allHealthy = Object.values(checks).every(
    (c) => c.status === "healthy"
  );
  const anyUnhealthy = Object.values(checks).some(
    (c) => c.status === "unhealthy"
  );

  const overallStatus = anyUnhealthy
    ? "unhealthy"
    : allHealthy
      ? "healthy"
      : "degraded";

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime_ms: process.uptime() * 1000,
      total_latency_ms: Date.now() - start,
      checks,
      version: process.env.NEXT_PUBLIC_APP_VERSION || "unknown",
      environment: process.env.NODE_ENV,
    },
    { status: statusCode }
  );
}
