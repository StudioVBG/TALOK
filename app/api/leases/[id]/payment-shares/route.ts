export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { paymentSharesService } from "@/features/tenant/services/payment-shares.service";

/**
 * GET /api/leases/[id]/payment-shares - Récupérer les parts de paiement d'un bail
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    if (!month) {
      return NextResponse.json(
        { error: "Paramètre 'month' requis (format: YYYY-MM-01)" },
        { status: 400 }
      );
    }

    const shares = await paymentSharesService.getPaymentSharesInternal(
      params.id,
      month,
      user.id
    );

    return NextResponse.json(shares);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

