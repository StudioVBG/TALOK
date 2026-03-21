export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { createClient, createClientFromRequest } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createLease } from "@/lib/services/lease-creation.service";

const inviteeSchema = z.object({
  email: z.string().email("Email invalide"),
  name: z.string().nullable().optional(),
  role: z.enum(["principal", "colocataire"]),
  weight: z.number().min(0).max(1).optional(),
  room_label: z.string().nullable().optional(),
  has_guarantor: z.boolean().optional(),
  guarantor_email: z.string().email().nullable().optional(),
  guarantor_name: z.string().nullable().optional(),
});

const colocConfigSchema = z.object({
  nb_places: z.number().min(2).max(10),
  bail_type: z.enum(["unique", "individuel"]),
  solidarite: z.boolean(),
  solidarite_duration_months: z.number().min(1).max(6),
  split_mode: z.enum(["equal", "custom", "by_room"]),
});

const inviteSchema = z.object({
  property_id: z.string().uuid("ID de propriété invalide"),
  type_bail: z.string().min(1, "Type de bail requis"),
  signatory_entity_id: z.string().uuid().nullable().optional(),
  loyer: z.number().positive("Loyer doit être positif"),
  charges_forfaitaires: z.number().min(0).default(0),
  charges_type: z.enum(["forfait", "provisions"]).default("forfait"),
  depot_garantie: z.number().min(0).default(0),
  date_debut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format de date invalide"),
  date_fin: z.string().nullable().optional(),
  jour_paiement: z.number().int().min(1).max(28).default(5),
  tenant_email: z.string().email().nullable().optional(),
  tenant_name: z.string().nullable().optional(),
  is_manual_draft: z.boolean().optional(),
  custom_clauses: z.array(z.object({ id: z.string(), text: z.string(), isCustom: z.boolean() })).optional(),
  tax_regime: z.enum(["micro_bic", "reel_bic", "micro_foncier", "reel_foncier"]).nullable().optional(),
  lmnp_status: z.enum(["lmnp", "lmp"]).nullable().optional(),
  furniture_inventory: z.array(z.any()).optional(),
  furniture_additional: z.array(z.any()).optional(),
  coloc_config: colocConfigSchema.optional(),
  invitees: z.array(inviteeSchema).optional(),
});

/**
 * POST /api/leases/invite — Creer un bail + inviter locataires
 * SOTA 2026: Delegue a LeaseCreationService
 */
export async function POST(request: Request) {
  try {
    let supabase = await createClient();
    let { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      supabase = await createClientFromRequest(request);
      const authResult = await supabase.auth.getUser();
      user = authResult.data.user;
      authError = authResult.error;
    }

    if (authError || !user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("id, role, prenom, nom").eq("user_id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    if (profile.role !== "owner" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validated = inviteSchema.parse(body);

    const isColocationRequest = validated.type_bail === "colocation" && validated.invitees && validated.invitees.length > 0;
    const isManualDraft = validated.is_manual_draft === true;

    if (!isColocationRequest && !validated.tenant_email && !isManualDraft) {
      return NextResponse.json({ error: "Email du locataire requis" }, { status: 400 });
    }

    const mode = isManualDraft ? "draft" : isColocationRequest ? "colocation" : "invite";

    const result = await createLease({
      mode: mode as any,
      ownerProfileId: profile.id,
      ownerName: `${profile.prenom || ""} ${profile.nom || ""}`.trim(),
      propertyId: validated.property_id,
      typeBail: validated.type_bail,
      signatoryEntityId: validated.signatory_entity_id || null,
      loyer: validated.loyer,
      chargesForfaitaires: validated.charges_forfaitaires,
      chargesType: validated.charges_type,
      depotGarantie: validated.depot_garantie,
      dateDebut: validated.date_debut,
      dateFin: validated.date_fin || null,
      jourPaiement: validated.jour_paiement,
      customClauses: validated.custom_clauses,
      taxRegime: validated.tax_regime,
      lmnpStatus: validated.lmnp_status,
      furnitureInventory: validated.furniture_inventory,
      tenantEmail: validated.tenant_email,
      tenantName: validated.tenant_name,
      colocConfig: validated.coloc_config as any,
      invitees: validated.invitees as any,
    });

    revalidatePath(`/owner/properties/${validated.property_id}`);
    revalidatePath("/owner/properties");
    revalidatePath("/owner/leases");

    return NextResponse.json({
      success: true,
      lease_id: result.leaseId,
      is_colocation: isColocationRequest,
      invitees: result.inviteeSummary.map((s) => ({
        email: s.email,
        invite_url: s.inviteUrl,
        email_sent: s.emailSent,
      })),
      emails_sent_count: result.inviteeSummary.filter((s) => s.emailSent).length,
      existing_accounts_count: result.inviteeSummary.filter((s) => s.exists).length,
      message: result.message,
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}
