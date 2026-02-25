export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/owner/payment-methods/audit
 * Retourne le journal d'audit PSD3 des opérations sur les moyens de paiement propriétaire.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const { data: rows, error } = await supabase
      .from("owner_payment_audit_log")
      .select("id, action, payment_method_type, metadata, ip_address, user_agent, created_at")
      .eq("owner_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      // Table peut être absente si la migration n'est pas appliquée : ne pas faire 500, renvoyer liste vide
      console.warn("[owner/payment-methods/audit] Erreur lecture audit:", error.message);
      return NextResponse.json({ audit: [] });
    }

    return NextResponse.json({ audit: rows ?? [] });
  } catch (error) {
    return handleApiError(error);
  }
}
