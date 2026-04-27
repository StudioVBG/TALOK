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

type DeclarationType = "2044" | "2072" | "2065" | "2031" | "micro-foncier" | "2042-cpro";

const VALID_TYPES: DeclarationType[] = ["2044", "2072", "2065", "2031", "micro-foncier", "2042-cpro"];

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
 *
 * Ligne 221 ("Frais d'administration et de gestion") accepte au choix :
 *   1. un forfait legal de 20 EUR / local declare (sans justificatif),
 *   2. les frais reels (avec justificatifs : honoraires comptables,
 *      juridiques, divers — comptes 622xxx, plus 627000 frais bancaires).
 * Le proprietaire doit prendre la solution LA PLUS AVANTAGEUSE. La version
 * historique forcait le forfait, ce qui sous-evaluait les charges quand
 * un EC etait paye et gonflait artificiellement le revenu foncier. On
 * calcule les deux et on retient le max ; les deux sont remontes dans
 * la reponse pour permettre a l'UI/EC de tracer le choix.
 */
function compute2044(balance: BalanceItem[], nbLocaux: number) {
  const ligne_215 = sumCredit(balance, "706"); // loyers bruts
  const ligne_221_forfait = nbLocaux * 2000; // forfait legal 20 EUR/local
  const ligne_221_reel = sumDebit(balance, "622") + sumDebit(balance, "627"); // honoraires + frais bancaires
  const ligne_221 = Math.max(ligne_221_forfait, ligne_221_reel);
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
    ligne_221_forfait,
    ligne_221_reel,
    ligne_221_choice:
      ligne_221_reel >= ligne_221_forfait ? ("reel" as const) : ("forfait" as const),
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

  // Fetch associates and their quote-parts. Filtre les quote_part_pct
  // null/0 : sans cette protection, Math.round(resultat * null / 100)
  // produit NaN qui se serialise mal en JSON et casse l'UI.
  const { data: associates } = await (supabase as any)
    .from("entity_associates")
    .select("id, name, quote_part_pct")
    .eq("entity_id", entityId);

  const validAssociates = (associates ?? []).filter(
    (a: { quote_part_pct: number | null }) =>
      typeof a.quote_part_pct === "number" && a.quote_part_pct > 0,
  );
  const skippedAssociates = (associates ?? []).filter(
    (a: { quote_part_pct: number | null }) =>
      !(typeof a.quote_part_pct === "number" && a.quote_part_pct > 0),
  );

  const resultat_par_associe = validAssociates.map(
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
    skipped_associates_count: skippedAssociates.length,
  };
}

/**
 * Compute 2065 declaration (SCI / societe a l'IS).
 *
 * Fournit les agregats du compte de resultat (charges, produits) et le
 * resultat fiscal avant impot. Le calcul de l'IS lui-meme reste de la
 * responsabilite de l'EC : il depend de reintegrations / deductions
 * extra-comptables que TALOK ne tracke pas (provisions reglementees,
 * amortissements derogatoires, etc.).
 */
function compute2065(balance: BalanceItem[]) {
  // Produits d'exploitation
  const produits_loyers = sumCredit(balance, "706");
  const produits_charges_recup = sumCredit(balance, "708");
  const produits_financiers = sumCredit(balance, "76");
  const produits_exceptionnels = sumCredit(balance, "77");
  const produits_total =
    produits_loyers +
    produits_charges_recup +
    produits_financiers +
    produits_exceptionnels;

  // Charges
  const charges_externes =
    sumDebit(balance, "61") + sumDebit(balance, "62"); // services exterieurs
  const charges_impots = sumDebit(balance, "63"); // impots et taxes
  const charges_personnel = sumDebit(balance, "64"); // personnel
  const charges_financieres = sumDebit(balance, "66"); // interets emprunt
  const dotations_amortissements = sumDebit(balance, "681");
  const charges_exceptionnelles = sumDebit(balance, "67");
  const charges_total =
    charges_externes +
    charges_impots +
    charges_personnel +
    charges_financieres +
    dotations_amortissements +
    charges_exceptionnelles;

  const resultat_avant_impot = produits_total - charges_total;
  // Taux IS reduit (15%) jusqu'a 42 500 EUR de benefice, taux normal 25% au-dela
  const seuil_taux_reduit_cents = 42_500_00;
  const is_taux_reduit_cents =
    resultat_avant_impot > 0
      ? Math.round(Math.min(resultat_avant_impot, seuil_taux_reduit_cents) * 0.15)
      : 0;
  const is_taux_normal_cents =
    resultat_avant_impot > seuil_taux_reduit_cents
      ? Math.round((resultat_avant_impot - seuil_taux_reduit_cents) * 0.25)
      : 0;
  const is_total_cents = is_taux_reduit_cents + is_taux_normal_cents;
  const resultat_apres_impot = resultat_avant_impot - is_total_cents;

  return {
    type: "2065" as const,
    produits: {
      loyers: produits_loyers,
      charges_recuperees: produits_charges_recup,
      financiers: produits_financiers,
      exceptionnels: produits_exceptionnels,
      total: produits_total,
    },
    charges: {
      externes: charges_externes,
      impots_taxes: charges_impots,
      personnel: charges_personnel,
      financieres: charges_financieres,
      dotations_amortissements,
      exceptionnelles: charges_exceptionnelles,
      total: charges_total,
    },
    resultat_avant_impot,
    is_taux_reduit_cents,
    is_taux_normal_cents,
    is_total_cents,
    resultat_apres_impot,
  };
}

/**
 * Compute 2031 declaration (BIC reel - location meublee professionnelle).
 *
 * Equivalent du regime reel pour les revenus de location meublee : le
 * loyer est traite comme une recette commerciale, les charges et amortis
 * sements sont deductibles, et le resultat est impose au bareme IR.
 *
 * La distinction LMP / LMNP impacte l'imputation du deficit (revenu
 * global pour LMP, BIC seulement pour LMNP) — TALOK ne tranche pas, on
 * fournit le resultat brut et l'EC rattache au bon regime.
 */
function compute2031(balance: BalanceItem[]) {
  const recettes = sumCredit(balance, "706") + sumCredit(balance, "708");
  const charges_externes =
    sumDebit(balance, "61") + sumDebit(balance, "62");
  const charges_impots = sumDebit(balance, "63");
  const charges_financieres = sumDebit(balance, "66");
  const dotations_amortissements = sumDebit(balance, "681");
  const total_charges =
    charges_externes +
    charges_impots +
    charges_financieres +
    dotations_amortissements;
  const resultat_bic = recettes - total_charges;

  return {
    type: "2031" as const,
    recettes_bic: recettes,
    charges: {
      externes: charges_externes,
      impots_taxes: charges_impots,
      financieres: charges_financieres,
      dotations_amortissements,
      total: total_charges,
    },
    resultat_bic,
    deficit_lmnp_reportable: resultat_bic < 0 ? -resultat_bic : 0,
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
    const format = searchParams.get("format") ?? "json";

    if (!exerciseId || !entityId) {
      throw new ApiError(400, "exerciseId et entityId sont requis");
    }

    // Ownership guard. getBalance/getGrandLivre passent par le client
    // user-scoped donc RLS protege deja, mais on double l'enforcement
    // avec une lecture explicite : si l'utilisateur passe un entityId
    // qui ne lui appartient pas, on echoue 403 plutot que de retourner
    // une declaration vide (ou pire, polluer le compteur de proprietes
    // partage). Admin bypasse comme partout ailleurs.
    if (profile.role !== "admin") {
      const { data: entity } = await (supabase as any)
        .from("legal_entities")
        .select("id")
        .eq("id", entityId)
        .eq("owner_profile_id", profile.id)
        .maybeSingle();
      if (!entity) {
        throw new ApiError(403, "Acces refuse a cette entite");
      }
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
      case "2065":
        declaration = compute2065(balance);
        break;
      case "2031":
        declaration = compute2031(balance);
        break;
      case "2042-cpro":
        declaration = compute2042Cpro(balance);
        break;
      default:
        throw new ApiError(400, `Type non supporte: ${type}`);
    }

    if (format === "pdf" && (type === "2065" || type === "2031")) {
      const { data: entity } = await supabase
        .from("legal_entities")
        .select("name, siren")
        .eq("id", entityId)
        .maybeSingle();

      const { data: exercise } = await supabase
        .from("accounting_exercises")
        .select("end_date")
        .eq("id", exerciseId)
        .maybeSingle();

      const year = exercise?.end_date
        ? new Date(exercise.end_date as string).getUTCFullYear()
        : new Date().getUTCFullYear();
      const ownerName =
        (entity?.name as string | undefined) ?? "Societe";
      const siren = (entity?.siren as string | undefined) ?? undefined;

      let pdf: Uint8Array;
      let filename: string;

      if (type === "2065") {
        const d = declaration as ReturnType<typeof compute2065>;
        const { generateCerfa2065Pdf } = await import(
          "@/lib/accounting/exports/cerfa-2065-pdf"
        );
        pdf = await generateCerfa2065Pdf({
          year,
          ownerName,
          siren,
          produits: d.produits,
          charges: d.charges,
          resultat_avant_impot: d.resultat_avant_impot,
          is_taux_reduit_cents: d.is_taux_reduit_cents,
          is_taux_normal_cents: d.is_taux_normal_cents,
          is_total_cents: d.is_total_cents,
          resultat_apres_impot: d.resultat_apres_impot,
        });
        filename = `cerfa-2065-${year}.pdf`;
      } else {
        const d = declaration as ReturnType<typeof compute2031>;
        const { generateCerfa2031Pdf } = await import(
          "@/lib/accounting/exports/cerfa-2031-pdf"
        );
        pdf = await generateCerfa2031Pdf({
          year,
          ownerName,
          siren,
          recettes_bic: d.recettes_bic,
          charges: d.charges,
          resultat_bic: d.resultat_bic,
          deficit_lmnp_reportable: d.deficit_lmnp_reportable,
        });
        filename = `cerfa-2031-${year}.pdf`;
      }

      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (format === "pdf" && type === "2072") {
      const d = declaration as Awaited<ReturnType<typeof compute2072>>;

      const { data: entity } = await supabase
        .from("legal_entities")
        .select("name, siren")
        .eq("id", entityId)
        .maybeSingle();

      const { data: exercise } = await supabase
        .from("accounting_exercises")
        .select("end_date")
        .eq("id", exerciseId)
        .maybeSingle();

      const year = exercise?.end_date
        ? new Date(exercise.end_date as string).getUTCFullYear()
        : new Date().getUTCFullYear();

      const { generateCerfa2072Pdf } = await import(
        "@/lib/accounting/exports/cerfa-2072-pdf"
      );
      const pdf = await generateCerfa2072Pdf({
        year,
        ownerName: (entity?.name as string | undefined) ?? "Societe civile",
        siren: (entity?.siren as string | undefined) ?? undefined,
        revenus_bruts_cents: d.revenus_bruts,
        charges_deductibles_cents: d.charges_deductibles,
        resultat_cents: d.resultat,
        associates: d.resultat_par_associe.map(
          (a: {
            name: string;
            quotePartPct: number;
            resultatCents: number;
          }) => ({
            name: a.name,
            quotePartPct: a.quotePartPct,
            resultatCents: a.resultatCents,
          }),
        ),
      });

      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="cerfa-2072-${year}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    if (format === "pdf" && type === "2044") {
      const d = declaration as ReturnType<typeof compute2044>;

      const { data: entity } = await supabase
        .from("legal_entities")
        .select("name, siren")
        .eq("id", entityId)
        .maybeSingle();

      const { data: exercise } = await supabase
        .from("accounting_exercises")
        .select("end_date")
        .eq("id", exerciseId)
        .maybeSingle();

      const year = exercise?.end_date
        ? new Date(exercise.end_date as string).getUTCFullYear()
        : new Date().getUTCFullYear();

      const { generateCerfa2044Pdf } = await import(
        "@/lib/accounting/exports/cerfa-2044-pdf"
      );
      const pdf = await generateCerfa2044Pdf({
        year,
        ownerName:
          (entity?.name as string | undefined) ?? "Proprietaire",
        siren: (entity?.siren as string | undefined) ?? undefined,
        ligne_215_cents: d.ligne_215,
        ligne_221_cents: d.ligne_221,
        ligne_222_cents: d.ligne_222,
        ligne_223_cents: d.ligne_223,
        ligne_224_cents: d.ligne_224,
        ligne_227_cents: d.ligne_227,
        ligne_229_cents: d.ligne_229,
        ligne_230_cents: d.ligne_230,
        case_4BA_cents: d.case_4BA,
        case_4BB_cents: d.case_4BB,
        case_4BC_cents: d.case_4BC,
      });

      return new NextResponse(Buffer.from(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="cerfa-2044-${year}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
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
