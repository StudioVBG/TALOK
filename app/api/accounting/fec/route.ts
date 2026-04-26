/**
 * API Route: Export FEC propriétaire
 * GET /api/accounting/fec?year=2025&entityId=xxx
 *
 * Export FEC conforme article L47 A-1 du LPF
 * Feature gate: hasFECExport (plan Confort+)
 * Format: CSV tab-separated, UTF-8, extension .txt
 * Filtre optionnel par legal_entity_id (via properties)
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { userHasFeature } from "@/lib/subscriptions/subscription-service";
import { resolvePropertyIdsForEntity } from "@/lib/accounting/resolve-entity-filter";

// 18 colonnes FEC normalisées
const FEC_HEADERS = [
  "JournalCode", "JournalLib", "EcritureNum", "EcritureDate",
  "CompteNum", "CompteLib", "CompAuxNum", "CompAuxLib",
  "PieceRef", "PieceDate", "EcritureLib", "Debit", "Credit",
  "EcritureLet", "DateLet", "ValidDate", "Montantdevise", "Idevise",
] as const;

type FECLine = Record<(typeof FEC_HEADERS)[number], string | number>;

function fecDate(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/-/g, "").slice(0, 8);
}

function fecAmount(euros: number): string {
  return euros.toFixed(2);
}

function fecNum(seq: number): string {
  return `FEC${String(seq).padStart(6, "0")}`;
}

function pushFecPair(
  lines: FECLine[],
  seq: { v: number },
  journal: string,
  journalLib: string,
  date: string,
  pieceRef: string,
  libelle: string,
  debitCompte: string,
  debitLib: string,
  creditCompte: string,
  creditLib: string,
  montant: number
) {
  if (montant <= 0) return;
  seq.v++;
  lines.push({
    JournalCode: journal, JournalLib: journalLib,
    EcritureNum: fecNum(seq.v), EcritureDate: fecDate(date),
    CompteNum: debitCompte, CompteLib: debitLib,
    CompAuxNum: "", CompAuxLib: "",
    PieceRef: pieceRef, PieceDate: fecDate(date),
    EcritureLib: libelle,
    Debit: fecAmount(montant), Credit: fecAmount(0),
    EcritureLet: "", DateLet: "", ValidDate: fecDate(date),
    Montantdevise: fecAmount(montant), Idevise: "EUR",
  });
  seq.v++;
  lines.push({
    JournalCode: journal, JournalLib: journalLib,
    EcritureNum: fecNum(seq.v), EcritureDate: fecDate(date),
    CompteNum: creditCompte, CompteLib: creditLib,
    CompAuxNum: "", CompAuxLib: "",
    PieceRef: pieceRef, PieceDate: fecDate(date),
    EcritureLib: libelle,
    Debit: fecAmount(0), Credit: fecAmount(montant),
    EcritureLet: "", DateLet: "", ValidDate: fecDate(date),
    Montantdevise: fecAmount(montant), Idevise: "EUR",
  });
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifié");

    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json(
        { error: "L'export pour votre comptable est disponible à partir du plan Confort.", upgrade: true },
        { status: 403 }
      );
    }

    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
      .from("profiles").select("id, role").eq("user_id", user.id).single();
    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    if (!yearParam) throw new ApiError(400, "Le paramètre year est requis");
    const year = parseInt(yearParam);
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) {
      throw new ApiError(400, "Année invalide");
    }

    const ownerId = profile.id;
    const entityId = searchParams.get("entityId");
    const propIds = await resolvePropertyIdsForEntity(serviceClient, ownerId, entityId);

    // ── Paiements de loyers ──
    let paymentsQuery = serviceClient
      .from("payments")
      .select(`
        id, montant, date_paiement,
        invoice:invoices!inner(
          id, periode, montant_loyer, montant_charges, owner_id, property_id,
          lease:leases!inner(property:properties!inner(adresse_complete))
        )
      `)
      .eq("statut", "succeeded")
      .eq("invoice.owner_id", ownerId)
      .gte("date_paiement", `${year}-01-01`)
      .lte("date_paiement", `${year}-12-31`)
      .order("date_paiement", { ascending: true });
    if (propIds) paymentsQuery = paymentsQuery.in("invoice.property_id", propIds.length > 0 ? propIds : ["__none__"]);
    const { data: payments } = await paymentsQuery;

    // ── Dépôts de garantie ──
    let depositQuery = serviceClient
      .from("deposit_operations")
      .select("id, operation_type, montant, date_operation, property_id")
      .eq("owner_id", ownerId).eq("statut", "completed")
      .gte("date_operation", `${year}-01-01`).lte("date_operation", `${year}-12-31`)
      .order("date_operation", { ascending: true });
    if (propIds) depositQuery = depositQuery.in("property_id", propIds.length > 0 ? propIds : ["__none__"]);
    const { data: depositOps } = await depositQuery;

    // ── Dépenses (table expenses) ──
    let expensesQuery = serviceClient
      .from("expenses")
      .select("id, montant, date_depense, category, description, fournisseur, property_id")
      .eq("owner_profile_id", ownerId).eq("statut", "confirmed")
      .gte("date_depense", `${year}-01-01`).lte("date_depense", `${year}-12-31`)
      .order("date_depense", { ascending: true });
    if (propIds) expensesQuery = expensesQuery.in("property_id", propIds.length > 0 ? propIds : ["__none__"]);
    const { data: expenses } = await expensesQuery;

    // ── Générer les lignes FEC ──
    const lines: FECLine[] = [];
    const seq = { v: 0 };

    // Loyers → Journal LO / CH
    for (const p of (payments || []) as any[]) {
      const inv = p.invoice;
      if (!inv) continue;
      const addr = inv.lease?.property?.adresse_complete || "Bien";
      const loyer = Number(inv.montant_loyer) || 0;
      const charges = Number(inv.montant_charges) || 0;
      const total = Number(p.montant) || 0;
      const date = p.date_paiement || "";
      const ref = `FA-${String(inv.id).slice(0, 8)}`;

      if (loyer > 0) {
        pushFecPair(lines, seq, "LO", "Loyers", date, ref,
          `Loyer ${inv.periode} — ${addr}`,
          "512000", "Banque", "706000", "Produits — Loyers", loyer);
      }
      if (charges > 0) {
        pushFecPair(lines, seq, "CH", "Charges", date, ref,
          `Charges ${inv.periode} — ${addr}`,
          "512000", "Banque", "708000", "Produits — Charges récupérables", charges);
      }
      // Si total > loyer+charges (arrondi), écrire la différence en loyer
      const diff = total - loyer - charges;
      if (diff > 0.01) {
        pushFecPair(lines, seq, "LO", "Loyers", date, ref,
          `Complément loyer ${inv.periode}`, "512000", "Banque", "706000", "Produits — Loyers", diff);
      }
    }

    // Dépôts de garantie → Journal DG
    for (const d of (depositOps || []) as any[]) {
      const montant = Number(d.montant) || 0;
      const isReception = d.operation_type === "reception";
      pushFecPair(lines, seq, "DG", "Dépôts de garantie", d.date_operation || "",
        `DG-${String(d.id).slice(0, 8)}`,
        `${isReception ? "Réception" : "Restitution"} dépôt de garantie`,
        isReception ? "512000" : "165000",
        isReception ? "Banque" : "Dépôts de garantie reçus",
        isReception ? "165000" : "512000",
        isReception ? "Dépôts de garantie reçus" : "Banque",
        montant);
    }

    // Dépenses / travaux → Journal TR
    for (const e of (expenses || []) as any[]) {
      const montant = Number(e.montant) || 0;
      pushFecPair(lines, seq, "TR", "Travaux et charges", e.date_depense || "",
        `DEP-${String(e.id).slice(0, 8)}`,
        `${e.description || e.category} ${e.fournisseur ? "— " + e.fournisseur : ""}`.trim(),
        "615000", "Entretien et réparations",
        "512000", "Banque",
        montant);
    }

    if (lines.length === 0) {
      throw new ApiError(404, `Aucune écriture comptable pour l'année ${year}`);
    }

    const header = FEC_HEADERS.join("\t");
    const rows = lines.map((l) => FEC_HEADERS.map((h) => String(l[h] ?? "")).join("\t"));
    const content = [header, ...rows].join("\n");
    const dateExport = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const filename = `FEC_TALOK_${year}_${dateExport}.txt`;
    const contentBytes = Buffer.from(content, "utf-8");
    const sha256 = createHash("sha256").update(contentBytes).digest("hex");

    // Record an integrity manifest so the company can prove later that
    // the file delivered to the tax authority was not tampered with.
    // Best-effort: a manifest insert failure must not block the download.
    let manifestId: string | null = null;
    try {
      const { data: manifest } = await serviceClient
        .from("fec_manifests")
        .insert({
          entity_id: entityId,
          fec_year: year,
          filename,
          file_size_bytes: contentBytes.byteLength,
          line_count: lines.length,
          sha256_hex: sha256,
          generated_by: user.id,
        } as Record<string, unknown>)
        .select("id")
        .single();
      manifestId = (manifest as { id: string } | null)?.id ?? null;
    } catch (manifestErr) {
      console.warn(
        "[FEC] manifest insert failed (non-blocking):",
        manifestErr,
      );
    }

    return new NextResponse(contentBytes, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-FEC-Year": String(year),
        "X-FEC-Records": String(lines.length),
        "X-FEC-SHA256": sha256,
        ...(manifestId ? { "X-FEC-Manifest-Id": manifestId } : {}),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
