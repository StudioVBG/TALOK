/**
 * API Route: Export FEC propriétaire
 * GET /api/accounting/fec?year=2025
 *
 * Export FEC conforme article L47 A-1 du LPF
 * Feature gate: hasFECExport (plan Confort+)
 * Format: CSV tab-separated, UTF-8, extension .txt
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { userHasFeature } from "@/lib/subscriptions/subscription-service";

// 18 colonnes FEC normalisées
const FEC_HEADERS = [
  "JournalCode",
  "JournalLib",
  "EcritureNum",
  "EcritureDate",
  "CompteNum",
  "CompteLib",
  "CompAuxNum",
  "CompAuxLib",
  "PieceRef",
  "PieceDate",
  "EcritureLib",
  "Debit",
  "Credit",
  "EcritureLet",
  "DateLet",
  "ValidDate",
  "Montantdevise",
  "Idevise",
] as const;

type FECLine = Record<(typeof FEC_HEADERS)[number], string | number>;

function fecDate(value: string | null | undefined): string {
  if (!value) return "";
  // Format YYYYMMDD (pas de tirets)
  return value.replace(/-/g, "").slice(0, 8);
}

function fecAmount(cents: number): string {
  // 2 décimales, point décimal, pas de séparateur de milliers
  return (cents / 100).toFixed(2);
}

function fecNum(seq: number): string {
  return `FEC${String(seq).padStart(6, "0")}`;
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Feature gate
    const hasAccess = await userHasFeature(user.id, "bank_reconciliation");
    if (!hasAccess) {
      return NextResponse.json(
        {
          error: "L'export pour votre comptable est disponible à partir du plan Confort.",
          upgrade: true,
        },
        { status: 403 }
      );
    }

    // Profil propriétaire
    const serviceClient = createServiceRoleClient();
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("id, role, nom, prenom")
      .eq("user_id", user.id)
      .single();

    if (!profile || (profile.role !== "owner" && profile.role !== "admin")) {
      throw new ApiError(403, "Accès réservé aux propriétaires");
    }

    // Paramètres
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get("year");
    if (!yearParam) {
      throw new ApiError(400, "Le paramètre year est requis");
    }
    const year = parseInt(yearParam);
    if (isNaN(year) || year < 2020 || year > new Date().getFullYear()) {
      throw new ApiError(400, "Année invalide");
    }

    const ownerId = profile.id;

    // ────────────────────────────────────────────
    // Récupérer les données financières de l'année
    // ────────────────────────────────────────────

    // 1. Paiements de loyers encaissés
    const { data: payments } = await serviceClient
      .from("payments")
      .select(`
        id,
        montant,
        moyen,
        date_paiement,
        statut,
        invoice:invoices!inner(
          id,
          periode,
          montant_loyer,
          montant_charges,
          montant_total,
          owner_id,
          tenant_id,
          lease:leases!inner(
            property:properties!inner(adresse_complete)
          )
        )
      `)
      .eq("statut", "succeeded")
      .eq("invoice.owner_id", ownerId)
      .gte("date_paiement", `${year}-01-01`)
      .lte("date_paiement", `${year}-12-31`)
      .order("date_paiement", { ascending: true });

    // 2. Opérations de dépôts de garantie
    const { data: depositOps } = await serviceClient
      .from("deposit_operations")
      .select("id, operation_type, montant, date_operation, lease_id, motif_retenue")
      .eq("owner_id", ownerId)
      .eq("statut", "completed")
      .gte("date_operation", `${year}-01-01`)
      .lte("date_operation", `${year}-12-31`)
      .order("date_operation", { ascending: true });

    // TODO: ajouter expenses quand la table existera

    // ────────────────────────────────────────────
    // Générer les lignes FEC
    // ────────────────────────────────────────────

    const lines: FECLine[] = [];
    let seq = 0;

    // Loyers encaissés → Journal LO
    for (const p of payments || []) {
      const inv = p.invoice as any;
      if (!inv) continue;
      const period = inv.periode || "";
      const datePaiement = (p as any).date_paiement || "";
      const addr =
        inv.lease?.property?.adresse_complete || "Bien";
      const loyerCents = Math.round(
        (Number(inv.montant_loyer) || 0) * 100
      );
      const chargesCents = Math.round(
        (Number(inv.montant_charges) || 0) * 100
      );
      const totalCents = Math.round((Number(p.montant) || 0) * 100);

      // Débit 512 (Banque) — encaissement total
      seq++;
      lines.push({
        JournalCode: "LO",
        JournalLib: "Loyers",
        EcritureNum: fecNum(seq),
        EcritureDate: fecDate(datePaiement),
        CompteNum: "512000",
        CompteLib: "Banque",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: `FA-${(inv.id as string).slice(0, 8)}`,
        PieceDate: fecDate(datePaiement),
        EcritureLib: `Loyer ${period} — ${addr}`,
        Debit: fecAmount(totalCents),
        Credit: fecAmount(0),
        EcritureLet: "",
        DateLet: "",
        ValidDate: fecDate(datePaiement),
        Montantdevise: fecAmount(totalCents),
        Idevise: "EUR",
      });

      // Crédit 706 (Loyers) — part loyer
      if (loyerCents > 0) {
        seq++;
        lines.push({
          JournalCode: "LO",
          JournalLib: "Loyers",
          EcritureNum: fecNum(seq),
          EcritureDate: fecDate(datePaiement),
          CompteNum: "706000",
          CompteLib: "Produits — Loyers",
          CompAuxNum: "",
          CompAuxLib: "",
          PieceRef: `FA-${(inv.id as string).slice(0, 8)}`,
          PieceDate: fecDate(datePaiement),
          EcritureLib: `Loyer ${period} — ${addr}`,
          Debit: fecAmount(0),
          Credit: fecAmount(loyerCents),
          EcritureLet: "",
          DateLet: "",
          ValidDate: fecDate(datePaiement),
          Montantdevise: fecAmount(loyerCents),
          Idevise: "EUR",
        });
      }

      // Crédit 708 (Charges) — part charges
      if (chargesCents > 0) {
        seq++;
        lines.push({
          JournalCode: "CH",
          JournalLib: "Charges",
          EcritureNum: fecNum(seq),
          EcritureDate: fecDate(datePaiement),
          CompteNum: "708000",
          CompteLib: "Produits — Charges récupérables",
          CompAuxNum: "",
          CompAuxLib: "",
          PieceRef: `FA-${(inv.id as string).slice(0, 8)}`,
          PieceDate: fecDate(datePaiement),
          EcritureLib: `Charges ${period} — ${addr}`,
          Debit: fecAmount(0),
          Credit: fecAmount(chargesCents),
          EcritureLet: "",
          DateLet: "",
          ValidDate: fecDate(datePaiement),
          Montantdevise: fecAmount(chargesCents),
          Idevise: "EUR",
        });
      }
    }

    // Dépôts de garantie → Journal DG
    for (const d of depositOps || []) {
      const montantCents = Math.round((Number(d.montant) || 0) * 100);
      const dateOp = d.date_operation || "";
      const isReception = d.operation_type === "reception";

      seq++;
      // Réception : Débit 512 / Crédit 165
      // Restitution : Débit 165 / Crédit 512
      lines.push({
        JournalCode: "DG",
        JournalLib: "Dépôts de garantie",
        EcritureNum: fecNum(seq),
        EcritureDate: fecDate(dateOp),
        CompteNum: isReception ? "512000" : "165000",
        CompteLib: isReception ? "Banque" : "Dépôts de garantie reçus",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: `DG-${(d.id as string).slice(0, 8)}`,
        PieceDate: fecDate(dateOp),
        EcritureLib: `${isReception ? "Réception" : "Restitution"} dépôt de garantie`,
        Debit: fecAmount(montantCents),
        Credit: fecAmount(0),
        EcritureLet: "",
        DateLet: "",
        ValidDate: fecDate(dateOp),
        Montantdevise: fecAmount(montantCents),
        Idevise: "EUR",
      });

      seq++;
      lines.push({
        JournalCode: "DG",
        JournalLib: "Dépôts de garantie",
        EcritureNum: fecNum(seq),
        EcritureDate: fecDate(dateOp),
        CompteNum: isReception ? "165000" : "512000",
        CompteLib: isReception ? "Dépôts de garantie reçus" : "Banque",
        CompAuxNum: "",
        CompAuxLib: "",
        PieceRef: `DG-${(d.id as string).slice(0, 8)}`,
        PieceDate: fecDate(dateOp),
        EcritureLib: `${isReception ? "Réception" : "Restitution"} dépôt de garantie`,
        Debit: fecAmount(0),
        Credit: fecAmount(montantCents),
        EcritureLet: "",
        DateLet: "",
        ValidDate: fecDate(dateOp),
        Montantdevise: fecAmount(montantCents),
        Idevise: "EUR",
      });
    }

    if (lines.length === 0) {
      throw new ApiError(
        404,
        `Aucune écriture comptable pour l'année ${year}`
      );
    }

    // ────────────────────────────────────────────
    // Générer le fichier tab-separated
    // ────────────────────────────────────────────

    const header = FEC_HEADERS.join("\t");
    const rows = lines.map((l) =>
      FEC_HEADERS.map((h) => String(l[h] ?? "")).join("\t")
    );
    const content = [header, ...rows].join("\n");

    const dateExport = new Date()
      .toISOString()
      .split("T")[0]
      .replace(/-/g, "");
    const filename = `FEC_TALOK_${year}_${dateExport}.txt`;

    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-FEC-Year": String(year),
        "X-FEC-Records": String(lines.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
