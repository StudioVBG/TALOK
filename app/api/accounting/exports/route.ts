/**
 * API Route: /api/accounting/exports — DEPRECATED
 *
 * The legacy GET handler aggregated `invoices` + `payments` rows directly
 * (not the validated double-entry ledger) and emitted an incomplete FEC
 * with hardcoded account numbers. Submitting the resulting file to DGFIP
 * would have failed validation at minimum and could have triggered fines
 * for non-conformance with art. A47 A-1 LPF.
 *
 * The route is now a 410 Gone marker. Callers should migrate to:
 *   - GET /api/accounting/fec/{exerciseId}?siren=XXXXXXXXX
 *     for a conformant 18-column FEC text file (uses the engine in
 *     lib/accounting/fec.ts which reads only validated entries).
 *   - POST /api/exports with type='accounting'
 *     for an asynchronous CSV/Excel export.
 *
 * Grep `git log -- app/api/accounting/exports/route.ts` for the previous
 * implementation if needed.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error:
        "Cette route est depreciee et ne produisait pas un FEC conforme.",
      migrate_to: {
        fec: "GET /api/accounting/fec/{exerciseId}?siren=XXXXXXXXX",
        csv_xlsx: "POST /api/exports avec type='accounting'",
      },
    },
    { status: 410 },
  );
}
