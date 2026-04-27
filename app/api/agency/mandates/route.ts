export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * API Routes pour les mandats de gestion
 * GET /api/agency/mandates - Liste des mandats
 * POST /api/agency/mandates - Créer un mandat
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// Schéma de validation aligné sur agency_mandates (canonique Hoguet).
// Les anciens noms FR (numero_mandat, type_mandat, commission_pourcentage…)
// ne sont plus acceptés — la migration des callers est triviale (mapping
// 1-pour-1) et la page /new ne fait pas encore d'appel réel, donc le
// breaking change ne casse personne en pratique.
const createMandateSchema = z.object({
  owner_profile_id: z.string().uuid("ID propriétaire invalide"),
  // agency_entity_id optionnel : on auto-résout via legal_entities
  // owned by l'agence si absent (cas par défaut). Le caller peut le
  // forcer si l'agence a plusieurs entités juridiques.
  agency_entity_id: z.string().uuid().optional(),
  mandate_type: z
    .enum(["gestion", "location", "syndic", "transaction"])
    .default("gestion"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date début invalide"),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date fin invalide")
    .optional()
    .nullable(),
  tacit_renewal: z.boolean().default(true),
  property_ids: z.array(z.string().uuid()).optional().default([]),
  management_fee_type: z.enum(["percentage", "fixed"]).default("percentage"),
  management_fee_rate: z.number().min(0).max(100).optional(),
  management_fee_fixed_cents: z.number().int().nonnegative().optional(),
  mandant_bank_iban: z.string().optional(),
  mandant_bank_bic: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Paramètres de requête. Le filtre `statut` (FR) est gardé pour
    // compat ascendante avec l'UI legacy ; aligné en interne avec
    // `status` côté agency_mandates (anglais Hoguet).
    const searchParams = request.nextUrl.searchParams;
    const statut = searchParams.get("statut") ?? searchParams.get("status");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = (page - 1) * limit;

    // Lecture sur agency_mandates (table canonique Hoguet, cf. décision 1
    // de l'audit). La table legacy `mandates` reste en BDD pour les
    // données historiques mais n'est plus exposée par cette route — la
    // détail page (/api/agency/mandates/[id]) lit déjà agency_mandates,
    // donc list et détail sont maintenant alignés.
    let query = (supabase as any)
      .from("agency_mandates")
      .select(
        `
        id, mandate_number, mandate_type, status,
        start_date, end_date,
        management_fee_type, management_fee_rate, management_fee_fixed_cents,
        property_ids, created_at,
        owner:profiles!agency_mandates_owner_profile_id_fkey(
          id, prenom, nom, email, telephone
        ),
        account:agency_mandant_accounts(
          balance_cents, last_reversement_at, reversement_overdue
        )
      `,
        { count: "exact" },
      )
      .eq("agency_profile_id", profile.id);

    if (statut && statut !== "all") {
      query = query.eq("status", statut);
    }

    if (type && type !== "all") {
      query = query.eq("mandate_type", type);
    }

    const { data: rows, count, error } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("Erreur récupération mandats:", error);
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? (error as Error).message
              : "Une erreur est survenue",
        },
        { status: 500 },
      );
    }

    // Normalise le payload pour que l'UI puisse afficher une vue
    // lisible sans répliquer la logique fee-type / property_ids partout.
    const mandates = ((rows ?? []) as any[]).map((m) => {
      const account = Array.isArray(m.account) ? m.account[0] : m.account;
      const owner = m.owner;
      const ownerName = owner
        ? `${owner.prenom ?? ""} ${owner.nom ?? ""}`.trim()
        : "";
      const commissionDisplay =
        m.management_fee_type === "fixed"
          ? m.management_fee_fixed_cents != null
            ? `${(m.management_fee_fixed_cents / 100).toFixed(2)} €`
            : null
          : m.management_fee_rate != null
            ? `${m.management_fee_rate}%`
            : null;
      const propertyIds = (m.property_ids ?? []) as string[];
      return {
        id: m.id,
        numeroMandat: m.mandate_number,
        type: m.mandate_type,
        status: m.status,
        dateDebut: m.start_date,
        dateFin: m.end_date,
        biensCount: propertyIds.length,
        commission: m.management_fee_rate ?? null,
        commissionFixedCents: m.management_fee_fixed_cents ?? null,
        commissionType: m.management_fee_type,
        commissionDisplay,
        owner: {
          id: owner?.id ?? null,
          name: ownerName,
          email: owner?.email ?? null,
          phone: owner?.telephone ?? null,
        },
        balanceCents: account?.balance_cents ?? 0,
        reversementOverdue: account?.reversement_overdue ?? false,
        lastReversementAt: account?.last_reversement_at ?? null,
        createdAt: m.created_at,
      };
    });

    return NextResponse.json({
      mandates,
      total: count || 0,
      page,
      limit,
    });
  } catch (error: unknown) {
    console.error("Erreur API agency mandates GET:", error);
    return NextResponse.json({ error: error instanceof Error ? (error as Error).message : "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    if (profile.role !== "agency" && profile.role !== "admin") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Valider les données
    const body = await request.json();
    const validatedData = createMandateSchema.parse(body);

    // Cohérence tarification : si percentage, rate doit être fourni ;
    // si fixed, fixed_cents doit l'être. Sinon le mandat est créé sans
    // tarification — autorisé mais l'agence devra éditer avant le 1er
    // paiement (sinon la commission auto sera 0).
    if (
      validatedData.management_fee_type === "percentage" &&
      validatedData.management_fee_rate == null
    ) {
      return NextResponse.json(
        {
          error:
            "management_fee_rate requis quand management_fee_type='percentage'",
        },
        { status: 400 },
      );
    }
    if (
      validatedData.management_fee_type === "fixed" &&
      validatedData.management_fee_fixed_cents == null
    ) {
      return NextResponse.json(
        {
          error:
            "management_fee_fixed_cents requis quand management_fee_type='fixed'",
        },
        { status: 400 },
      );
    }

    // Vérifier que le propriétaire existe et est bien un owner
    const { data: owner } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("id", validatedData.owner_profile_id)
      .eq("role", "owner")
      .single();

    if (!owner) {
      return NextResponse.json(
        { error: "Propriétaire non trouvé" },
        { status: 404 }
      );
    }

    // Auto-résoudre l'entité juridique de l'agence si non fournie. La
    // table agency_mandates exige agency_entity_id NOT NULL — sans
    // entité, l'agence ne peut pas tenir de comptabilité Hoguet
    // séparée (compte mandant 545, etc.). On erreur explicitement
    // plutôt que d'inventer.
    let agencyEntityId = validatedData.agency_entity_id;
    if (!agencyEntityId) {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("id")
        .eq("owner_profile_id", profile.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      agencyEntityId = entity?.id;
    }
    if (!agencyEntityId) {
      return NextResponse.json(
        {
          error:
            "Aucune entité juridique trouvée pour cette agence. Créez d'abord votre entité via /agency/settings.",
        },
        { status: 400 },
      );
    }

    // Générer un numéro de mandat séquentiel par agence (UNIQUE par
    // agency_profile_id + mandate_number — cf. index unique dans
    // 20260408120000_whitelabel_agency_module.sql).
    const { count } = await (supabase as any)
      .from("agency_mandates")
      .select("id", { count: "exact", head: true })
      .eq("agency_profile_id", profile.id);

    const mandateNumber = `MAN-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, "0")}`;

    // Créer le mandat sur agency_mandates (canonique).
    const { data: mandate, error: createError } = await (supabase as any)
      .from("agency_mandates")
      .insert({
        agency_profile_id: profile.id,
        agency_entity_id: agencyEntityId,
        owner_profile_id: validatedData.owner_profile_id,
        mandate_number: mandateNumber,
        mandate_type: validatedData.mandate_type,
        start_date: validatedData.start_date,
        end_date: validatedData.end_date ?? null,
        tacit_renewal: validatedData.tacit_renewal,
        property_ids: validatedData.property_ids,
        management_fee_type: validatedData.management_fee_type,
        management_fee_rate: validatedData.management_fee_rate ?? null,
        management_fee_fixed_cents:
          validatedData.management_fee_fixed_cents ?? null,
        mandant_bank_iban: validatedData.mandant_bank_iban ?? null,
        mandant_bank_bic: validatedData.mandant_bank_bic ?? null,
        status: "draft",
      })
      .select()
      .single();

    if (createError) {
      console.error("Erreur création mandat:", createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json(mandate, { status: 201 });
  } catch (error: unknown) {
    if ((error as any).name === "ZodError") {
      return NextResponse.json(
        { error: "Données invalides", details: (error as any).errors },
        { status: 400 }
      );
    }
    console.error("Erreur API agency mandates POST:", error);
    return NextResponse.json({ error: error instanceof Error ? (error as Error).message : "Erreur serveur" }, { status: 500 });
  }
}

