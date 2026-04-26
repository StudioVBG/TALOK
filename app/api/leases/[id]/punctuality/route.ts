export const dynamic = "force-dynamic";

/**
 * GET /api/leases/:id/punctuality
 *
 * Retourne le score de ponctualité d'un bail.
 * Accessible par le propriétaire du bail.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabase/service-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leaseId } = await params;
  const authClient = await createClient();

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // Service-role + check explicite owner/admin
  // (cf. docs/audits/rls-cascade-audit.md)
  const supabase = getServiceClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
  }

  const { data: lease } = await supabase
    .from("leases")
    .select("id, owner_id")
    .eq("id", leaseId)
    .maybeSingle();

  if (!lease) {
    return NextResponse.json({ error: "Bail non trouvé" }, { status: 404 });
  }

  const isAdmin = profile.role === "admin";
  if (lease.owner_id !== profile.id && !isAdmin) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { data: scoreRow } = await supabase
    .from("leases")
    .select("punctuality_score" as any)
    .eq("id", leaseId)
    .maybeSingle();

  const score = (scoreRow as any)?.punctuality_score != null
    ? Number((scoreRow as any).punctuality_score)
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
