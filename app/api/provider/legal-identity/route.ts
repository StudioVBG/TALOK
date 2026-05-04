/**
 * API Route : POST /api/provider/legal-identity
 *
 * Persiste l'identité légale d'un artisan/prestataire dans la table
 * `providers`, à partir des données résolues par /api/siret/resolve
 * (auto-fill INSEE) éventuellement complétées manuellement (RC pro,
 * décennale, qualifications…).
 *
 * Upsert : si la ligne `providers` liée au profil n'existe pas, elle est
 * créée ; sinon, elle est mise à jour. C'est appelé pendant l'onboarding
 * prestataire (étape "Profil"), donc un appel ⇒ une ligne canonique.
 *
 * Auth : utilisateur authentifié avec role = 'provider' (ou admin).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handleApiError } from "@/lib/helpers/api-error";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  // Champs API (issus de /api/siret/resolve)
  siret: z.string().regex(/^\d{14}$/, "SIRET invalide"),
  raison_sociale: z.string().min(1, "Raison sociale requise"),
  forme_juridique: z.string().nullable().optional(),
  nature_juridique_code: z.string().nullable().optional(),
  capital_social: z.number().nullable().optional(),
  date_creation: z.string().nullable().optional(),
  rcs_numero: z.string().nullable().optional(),
  rcs_ville: z.string().nullable().optional(),
  tva_intra: z.string().nullable().optional(),
  naf_code: z.string().nullable().optional(),
  naf_label: z.string().nullable().optional(),
  dirigeant_nom: z.string().nullable().optional(),
  dirigeant_prenom: z.string().nullable().optional(),
  dirigeant_qualite: z.string().nullable().optional(),
  est_rge: z.boolean().optional(),
  etat_administratif: z.enum(["A", "C"]).optional(),
  api_source: z.string().nullable().optional(),

  // Adresse (siège)
  address: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  city: z.string().nullable().optional(),

  // Contact (saisie utilisateur, déjà connu côté profil mais persisté ici
  // pour que la table `providers` soit autoporteuse côté marketplace)
  contact_name: z.string().min(1, "Nom du contact requis"),
  email: z.string().email("Email invalide"),
  phone: z.string().min(6, "Téléphone requis"),

  // Champs à saisir manuellement (non couverts par l'API)
  trade_categories: z.array(z.string()).optional(),
  decennale_number: z.string().nullable().optional(),
  decennale_expiry: z.string().nullable().optional(),
  insurance_number: z.string().nullable().optional(),
  insurance_expiry: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    const { data: profile } = await supabase.from("profiles").select("id, role").eq("user_id", user.id).single();

    if (!profile) {
      throw new ApiError(403, "Profil non trouvé");
    }

    if (!["provider", "admin"].includes(profile.role)) {
      throw new ApiError(403, "Réservé aux prestataires");
    }

    const json = await request.json();
    const body = BodySchema.parse(json);

    const payload = {
      profile_id: profile.id,
      company_name: body.raison_sociale,
      contact_name: body.contact_name,
      email: body.email,
      phone: body.phone,
      siret: body.siret,
      forme_juridique: body.forme_juridique ?? null,
      nature_juridique_code: body.nature_juridique_code ?? null,
      capital_social: body.capital_social ?? null,
      date_creation: body.date_creation ?? null,
      rcs_numero: body.rcs_numero ?? null,
      rcs_ville: body.rcs_ville ?? null,
      tva_intra: body.tva_intra ?? null,
      naf_code: body.naf_code ?? null,
      naf_label: body.naf_label ?? null,
      dirigeant_nom: body.dirigeant_nom ?? null,
      dirigeant_prenom: body.dirigeant_prenom ?? null,
      dirigeant_qualite: body.dirigeant_qualite ?? null,
      est_rge: body.est_rge ?? false,
      etat_administratif: body.etat_administratif ?? "A",
      api_source: body.api_source ?? "recherche-entreprises.api.gouv.fr",
      api_resolved_at: new Date().toISOString(),
      address: body.address ?? null,
      postal_code: body.postal_code ?? null,
      city: body.city ?? null,
      trade_categories: body.trade_categories ?? [],
      decennale_number: body.decennale_number ?? null,
      decennale_expiry: body.decennale_expiry ?? null,
      insurance_number: body.insurance_number ?? null,
      insurance_expiry: body.insurance_expiry ?? null,
      status: "active" as const,
    };

    const { data: existing } = await supabase.from("providers").select("id").eq("profile_id", profile.id).maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase.from("providers").update(payload).eq("id", existing.id).select().single();
      if (error) {
        console.error("[provider/legal-identity] update error:", error);
        throw new ApiError(500, "Erreur lors de la mise à jour de l'identité légale");
      }
      return NextResponse.json({ data, created: false });
    }

    const { data, error } = await supabase.from("providers").insert(payload).select().single();

    if (error) {
      console.error("[provider/legal-identity] insert error:", error);
      throw new ApiError(500, "Erreur lors de la création de l'identité légale");
    }

    return NextResponse.json({ data, created: true });
  } catch (error) {
    return handleApiError(error);
  }
}
