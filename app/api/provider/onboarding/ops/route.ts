export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/helpers/auth-helper";
import { getServiceClient } from "@/lib/supabase/service-client";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { providerOpsSchema } from "@/lib/validations/onboarding";

/**
 * PUT /api/provider/onboarding/ops
 * Persiste l'étape "Disponibilités & paiements" de l'onboarding prestataire :
 *  - Met à jour provider_profiles (jours, horaires, sla)
 *  - Upsert provider_payout_accounts avec l'IBAN saisi
 *  - Marque l'étape provider_ops comme complétée
 */
export async function PUT(request: Request) {
  try {
    const { user, error } = await getAuthenticatedUser(request);
    if (error || !user) {
      throw new ApiError(401, "Non authentifié");
    }

    const supabase = getServiceClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, prenom, nom")
      .eq("user_id", user.id)
      .single();

    if (!profile) throw new ApiError(404, "Profil non trouvé");
    if (profile.role !== "provider") throw new ApiError(403, "Accès non autorisé");

    const body = await request.json().catch(() => ({}));
    const validated = providerOpsSchema.parse(body);

    const { error: updateError } = await supabase
      .from("provider_profiles")
      .update({
        jours_disponibles: validated.jours_disponibles,
        horaires_debut: validated.horaires_debut,
        horaires_fin: validated.horaires_fin,
        sla_souhaite: validated.sla_souhaite,
      })
      .eq("profile_id", profile.id);

    if (updateError) {
      console.error("[ops] update provider_profiles:", updateError);
      throw new ApiError(500, "Erreur sauvegarde disponibilités");
    }

    const accountHolder =
      [profile.prenom, profile.nom].filter(Boolean).join(" ").trim() || "Prestataire Talok";

    const { data: existingPayout } = await supabase
      .from("provider_payout_accounts")
      .select("id")
      .eq("provider_profile_id", profile.id)
      .eq("is_default", true)
      .maybeSingle();

    if (existingPayout) {
      const { error: payoutErr } = await supabase
        .from("provider_payout_accounts")
        .update({
          iban: validated.payout_iban,
          account_holder_name: accountHolder,
          is_active: true,
        })
        .eq("id", existingPayout.id);
      if (payoutErr) {
        console.error("[ops] update payout:", payoutErr);
        throw new ApiError(500, "Erreur sauvegarde IBAN");
      }
    } else {
      const { error: payoutErr } = await supabase
        .from("provider_payout_accounts")
        .insert({
          provider_profile_id: profile.id,
          iban: validated.payout_iban,
          account_holder_name: accountHolder,
          is_default: true,
          is_active: true,
        });
      if (payoutErr) {
        console.error("[ops] insert payout:", payoutErr);
        throw new ApiError(500, "Erreur sauvegarde IBAN");
      }
    }

    const { error: progressErr } = await supabase
      .from("onboarding_progress")
      .upsert(
        {
          user_id: user.id,
          role: "provider",
          step: "provider_ops",
          completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,role,step" }
      );

    if (progressErr) {
      console.error("[ops] mark step completed:", progressErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return handleApiError(err);
  }
}
