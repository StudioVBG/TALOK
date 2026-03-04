export const runtime = 'nodejs';

/**
 * GET /api/cron/rent-reminders
 *
 * DEPRECATED — Ce système est remplacé par /api/cron/payment-reminders
 * qui est le système canonique de relance (utilise due_date, anti-doublon,
 * paliers J-3/J-1/J+1/J+7/J+15/J+30).
 *
 * Cette route redirige désormais vers payment-reminders pour éviter les
 * doublons de relance. Conservée pour compatibilité avec d'éventuels crons
 * externes configurés sur cette URL.
 */

import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  console.warn("[DEPRECATED] rent-reminders appelé — redirection vers payment-reminders");

  try {
    const response = await fetch(`${appUrl}/api/cron/payment-reminders`, {
      headers: {
        authorization: request.headers.get("authorization") || "",
      },
    });
    const data = await response.json();
    return NextResponse.json({
      ...data,
      _deprecated: true,
      _redirect: "/api/cron/payment-reminders",
      _message: "Ce endpoint est deprecated. Migrez vers /api/cron/payment-reminders.",
    }, { status: response.status });
  } catch (error: unknown) {
    return NextResponse.json({
      error: "Erreur redirection vers payment-reminders",
      details: error instanceof Error ? error.message : "Erreur inconnue",
      _deprecated: true,
      _redirect: "/api/cron/payment-reminders",
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
