export const dynamic = "force-dynamic";

/**
 * GET /api/leases/:id/punctuality
 *
 * Retourne le score de ponctualité d'un bail.
 * Accessible par le propriétaire du bail.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Vérifier que l'utilisateur est propriétaire de ce bail
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  const { data: lease, error: leaseError } = await supabase
    .from("leases")
    .select("id, punctuality_score, owner_id")
    .eq("id", leaseId)
    .single();

  if (leaseError || !lease) {
    return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
  }

  if (lease.owner_id !== profile.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const score = lease.punctuality_score != null
    ? Number(lease.punctuality_score)
    : null;

  const label =
    score === null
      ? "En construction"
      : score >= 90
        ? "Excellent"
        : score >= 70
          ? "Bon"
          : score >= 50
            ? "Moyen"
            : "À améliorer";

  const variant =
    score === null
      ? "secondary"
      : score >= 90
        ? "success"
        : score >= 70
          ? "default"
          : score >= 50
            ? "warning"
            : "destructive";

  return NextResponse.json({ score, label, variant });
}
