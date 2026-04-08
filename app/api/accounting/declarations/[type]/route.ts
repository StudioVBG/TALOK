/**
 * API Route: Assistant declaration fiscale (Sprint 4)
 * GET /api/accounting/declarations/[type]
 *
 * Calcule les montants ligne par ligne pour les declarations fiscales.
 * Types supportes: 2044, 2072, micro-foncier, 2042-cpro
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { requireAccountingAccess } from "@/lib/accounting/feature-gates";
import { getBalance, getGrandLivre } from "@/lib/accounting/engine";
import type { BalanceItem, GrandLivreItem } from "@/lib/accounting/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DeclarationType = "2044" | "2072" | "micro-foncier" | "2042-cpro";

const VALID_TYPES: DeclarationType[] = ["2044", "2072", "micro-foncier", "2042-cpro"];

/**
 * Sum credit cents for accounts matching a prefix pattern (706xxx, etc.)
 */
function sumCredit(balance: BalanceItem[], prefix: string): number {
  return balance
    .filter((b) => b.accountNumber.startsWith(prefix))
    .reduce((sum, b) => sum + b.totalCreditCents, 0);
}

/**
 * Sum debit cents for accounts matching a prefix pattern
 */
function sumDebit(balance: BalanceItem[], prefix: string): number {
  return balance
    .filter((b) => b.accountNumber.startsWith(prefix))
    .reduce((sum, b) => sum + b.totalDebitCents, 0);
}

/**
 * Compute 2044 declaration (regime reel - revenus fonciers)
 */
function compute2044(balance: BalanceItem[], nbLocaux: number) {
  const ligne_215 = sumCredit(balance, "706"); // loyers bruts
  const ligne_221 = nbLocaux * 2000; // forfait gestion 20 EUR/local
  const ligne_222 = sumDebit(balance, "616"); // assurances
  const ligne_223 = sumDebit(balance, "615"); // travaux
  const ligne_224 = sumDebit(balance, "661"); // interets emprunt
  const ligne_227 = sumDebit(balance, "635"); // taxe fonciere

  const ligne_229 = ligne_221 + ligne_222 + ligne_223 + ligne_224 + ligne_227;
  const ligne_230 = ligne_215 - ligne_229; // resultat net

  // Resultat hors interets pour calcul deficit
  const resultatHorsInterets = ligne_215 - (ligne_229 - ligne_224);

  const case_4BA = Math.max(0, ligne_230); // benefice foncier
  // Deficit imputable (hors interets d'emprunt), plafonne a 10700 EUR
  const case_4BB = Math.abs(Math.min(0, resultatHorsInterets));
  const case_4BB_capped = Math.min(case_4BB, 1070000); // 10700 EUR en centimes
  // Deficit excedentaire reportable
  const case_4BC =
    ligne_230 < 0
      ? Math.abs(ligne_230) - case_4BB_capped + (ligne_224 > 0 ? Math.min(ligne_224, Math.abs(ligne_230)) : 0)
      : 0;

  return {
    type: "2044" as const,
    ligne_215,
    ligne_221,
    ligne_222,
    ligne_223,
    ligne_224,
    ligne_227,
    ligne_229,
    ligne_230,
    case_4BA,
    case_4BB: case_4BB_capped,
    case_4BC: Math.max(0, case_4BC),
  };
}

/**
 * Compute micro-foncier declaration (revenus < 15000 EUR)
 */
function computeMicroFoncier(balance: BalanceItem[]) {
  const case_4BE = sumCredit(balance, "706"); // loyers bruts

  return {
    type: "micro-foncier" as const,
    case_4BE,
    eligible: case_4BE <= 1500000, // 15000 EUR en centimes
    abattement_30_pct: Math.round(case_4BE * 0.3),
    revenu_imposable: Math.round(case_4BE * 0.7),
  };
}

/**
 * Compute 2072 declaration (SCI a l'IR)
 */
async function compute2072(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  entityId: string,
  balance: BalanceItem[],
) {
  // Calculate resultat like 2044
  const revenus = sumCredit(balance, "706");
  const charges =
    sumDebit(balance, "616") +
    sumDebit(balance, "615") +
    sumDebit(balance, "661") +
    sumDebit(balance, "635");
  const resultat = revenus - charges;

  // Fetch associates and their quote-parts
  const { data: associates } = await supabase
    .from("entity_associates")
    .select("id, name, quote_part_pct")
    .eq("entity_id", entityId);

  const resultat_par_associe = (associates ?? []).map(
    (a: { id: string; name: string; quote_part_pct: number }) => ({
      associateId: a.id,
      name: a.name,
      quotePartPct: a.quote_part_pct,
      resultatCents: Math.round((resultat * a.quote_part_pct) / 100),
    }),
  );

  return {
    type: "2072" as const,
    revenus_bruts: revenus,
    charges_deductibles: charges,
    resultat,
    resultat_par_associe,
  };
}

/**
 * Compute 2042-CPRO (micro-BIC / location meublee)
 */
function compute2042Cpro(balance: BalanceItem[]) {
  const revenus_bruts = sumCredit(balance, "706");
  const abattement_50_pct = Math.round(revenus_bruts * 0.5);

  return {
    type: "2042-cpro" as const,
    revenus_bruts,
    abattement_50_pct,
    revenu_imposable: revenus_bruts - abattement_50_pct,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  try {
    const { type } = await params;

    if (!VALID_TYPES.includes(type as DeclarationType)) {
      throw new ApiError(
        400,
        `Type de declaration invalide: ${type}. Types valides: ${VALID_TYPES.join(", ")}`,
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifie");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouve");
    }

    const featureGate = await requireAccountingAccess(profile.id, "fiscal");
    if (featureGate) return featureGate;

    const { searchParams } = new URL(request.url);
    const exerciseId = searchParams.get("exerciseId");
    const entityId = searchParams.get("entityId");

    if (!exerciseId || !entityId) {
      throw new ApiError(400, "exerciseId et entityId sont requis");
    }

    // Fetch balance and grand livre for the exercise
    const balance = await getBalance(supabase, entityId, exerciseId);
    const grandLivre = await getGrandLivre(supabase, entityId, exerciseId);

    // Count properties (locaux) for forfait gestion
    const { count: nbLocaux } = await supabase
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", profile.id);

    let declaration: Record<string, unknown>;

    switch (type as DeclarationType) {
      case "2044":
        declaration = compute2044(balance, nbLocaux ?? 0);
        break;
      case "micro-foncier":
        declaration = computeMicroFoncier(balance);
        break;
      case "2072":
        declaration = await compute2072(supabase, entityId, balance);
        break;
      case "2042-cpro":
        declaration = compute2042Cpro(balance);
        break;
      default:
        throw new ApiError(400, `Type non supporte: ${type}`);
    }

    return NextResponse.json({
      success: true,
      data: declaration,
      meta: {
        type,
        exercise_id: exerciseId,
        entity_id: entityId,
        generated_at: new Date().toISOString(),
        disclaimer:
          "Ce document est une aide au remplissage. Talok ne fournit pas de conseil fiscal.",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
