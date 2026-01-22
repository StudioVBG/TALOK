export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { paymentSharesService } from "@/features/tenant/services/payment-shares.service";

/**
 * POST /api/leases/[id]/autopay - Activer/désactiver l'autopay
 *
 * @version 2026-01-22 - Fix: Next.js 15 params Promise pattern
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled, paymentShareId } = body;

    if (enabled === undefined || !paymentShareId) {
      return NextResponse.json(
        { error: "enabled et paymentShareId requis" },
        { status: 400 }
      );
    }

    // Vérifier que la part appartient à l'utilisateur
    const { data: roommate } = await supabase
      .from("roommates")
      .select("id")
      .eq("lease_id", id as any)
      .eq("user_id", user.id as any)
      .is("left_on", null)
      .single();

    if (!roommate) {
      return NextResponse.json(
        { error: "Vous n'êtes pas locataire de ce bail" },
        { status: 403 }
      );
    }

    const { data: paymentShare } = await supabase
      .from("payment_shares")
      .select("id, roommate_id")
      .eq("id", paymentShareId as any)
      .single();

    if (!paymentShare || !("roommate_id" in paymentShare) || !("id" in roommate) || (paymentShare as any).roommate_id !== (roommate as any).id) {
      return NextResponse.json(
        { error: "Part de paiement non trouvée" },
        { status: 404 }
      );
    }

    const updated = await paymentSharesService.toggleAutopayInternal(
      paymentShareId,
      enabled
    );

    return NextResponse.json({ paymentShare: updated });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

