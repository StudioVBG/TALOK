export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/copro/fund-calls/[id]/pdf?line_id=...
 * Retourne le HTML imprimable d'un appel de fonds (pour conversion en PDF côté navigateur).
 * Si line_id absent, retourne un récapitulatif global de l'appel.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";
import {
  generateCallForFundsHtml,
  type CallForFundsPdfData,
} from "@/lib/pdf/templates";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params;

  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get("line_id");

    const { data: call, error: callError } = await auth.serviceClient
      .from("copro_fund_calls")
      .select("id, site_id, call_number, period_label, due_date, total_amount_cents, total_amount, type, description")
      .eq("id", callId)
      .maybeSingle();

    if (callError || !call) {
      return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
    }

    const siteCheck = await requireSyndic(request, { siteId: (call as { site_id: string }).site_id });
    if (siteCheck instanceof NextResponse) return siteCheck;

    const { data: site } = await auth.serviceClient
      .from("sites")
      .select("name, address_line1, postal_code, city")
      .eq("id", (call as { site_id: string }).site_id)
      .maybeSingle();

    let lineRow: Record<string, unknown> | null = null;
    if (lineId) {
      const { data } = await auth.serviceClient
        .from("copro_fund_call_lines")
        .select("id, lot_id, owner_name, tantiemes, amount_cents")
        .eq("id", lineId)
        .maybeSingle();
      lineRow = (data as Record<string, unknown>) ?? null;
    }

    const totalAmount =
      (call as { total_amount_cents?: number | null; total_amount?: number | null }).total_amount_cents != null
        ? ((call as { total_amount_cents: number }).total_amount_cents) / 100
        : (call as { total_amount?: number }).total_amount ?? 0;

    const data: CallForFundsPdfData = {
      site_name: (site as { name?: string } | null)?.name ?? "Copropriété",
      site_address: site
        ? `${(site as { address_line1?: string }).address_line1 ?? ""} ${(site as { postal_code?: string }).postal_code ?? ""} ${(site as { city?: string }).city ?? ""}`.trim()
        : "",
      owner: {
        name: (lineRow?.owner_name as string) ?? "Copropriétaire",
        address: "",
      },
      unit: {
        lot_number: lineRow ? `Lot ${lineRow.lot_id ?? ""}` : "Tous les lots",
        description: "",
        tantiemes: (lineRow?.tantiemes as number) ?? 0,
        total_tantiemes: 10000,
      },
      call_number: (call as { call_number?: string }).call_number ?? `AF-${callId.slice(0, 8)}`,
      period_label: (call as { period_label?: string }).period_label ?? "",
      due_date: (call as { due_date?: string }).due_date ?? "",
      items: [
        {
          label: (call as { description?: string }).description ?? "Appel de fonds",
          amount:
            lineRow != null
              ? Math.max(0, ((lineRow.amount_cents as number) ?? 0)) / 100
              : totalAmount,
        },
      ],
      total_amount:
        lineRow != null
          ? Math.max(0, ((lineRow.amount_cents as number) ?? 0)) / 100
          : totalAmount,
      generated_at: new Date().toISOString(),
    };

    const html = generateCallForFundsHtml(data);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
