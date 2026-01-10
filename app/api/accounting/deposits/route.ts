/**
 * API Route: Gestion des dépôts de garantie
 * GET /api/accounting/deposits - Liste les dépôts
 * POST /api/accounting/deposits - Enregistre une opération sur dépôt
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";
import { AccountingIntegrationService } from "@/features/accounting/services/accounting-integration.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/accounting/deposits
 *
 * Query params:
 * - lease_id: string (optionnel) - Filtrer par bail
 * - tenant_id: string (optionnel) - Filtrer par locataire
 * - status: 'active' | 'restituted' | 'retained' (optionnel)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    // Parser les paramètres
    const { searchParams } = new URL(request.url);
    const leaseId = searchParams.get("lease_id");
    const tenantId = searchParams.get("tenant_id");
    const status = searchParams.get("status");

    // Construire la requête selon le rôle
    let query = supabase.from("deposit_operations").select(`
      *,
      lease:leases!inner(
        id,
        tenant_id,
        depot_de_garantie,
        property:properties!inner(
          id,
          adresse_ligne1,
          owner_id
        )
      )
    `);

    // Filtrer selon le rôle
    if (profile.role === "owner") {
      query = query.eq("lease.property.owner_id", profile.id);
    } else if (profile.role === "tenant") {
      query = query.eq("tenant_id", profile.id);
    } else if (profile.role !== "admin") {
      throw new ApiError(403, "Accès non autorisé");
    }

    // Appliquer les filtres optionnels
    if (leaseId) {
      query = query.eq("lease_id", leaseId);
    }
    if (tenantId && profile.role === "admin") {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: operations, error } = await query.order("operation_date", {
      ascending: false,
    });

    if (error) {
      throw new ApiError(500, "Erreur lors de la récupération des dépôts");
    }

    // Calculer le statut de chaque dépôt par bail
    const depositsByLease = new Map<string, any>();

    for (const op of operations || []) {
      const leaseData = op.lease as any;
      if (!depositsByLease.has(op.lease_id)) {
        depositsByLease.set(op.lease_id, {
          lease_id: op.lease_id,
          tenant_id: op.tenant_id,
          property_address: leaseData?.property?.adresse_ligne1 || "",
          initial_amount: leaseData?.depot_de_garantie || 0,
          current_balance: 0,
          operations: [],
          status: "active",
        });
      }

      const deposit = depositsByLease.get(op.lease_id);
      deposit.operations.push({
        id: op.id,
        type: op.operation_type,
        amount: op.amount,
        date: op.operation_date,
        description: op.description,
      });

      // Calculer le solde
      if (op.operation_type === "encaissement") {
        deposit.current_balance += op.amount;
      } else {
        deposit.current_balance -= op.amount;
      }

      // Déterminer le statut
      if (op.operation_type === "restitution" && deposit.current_balance === 0) {
        deposit.status = "restituted";
      } else if (op.operation_type === "retenue") {
        deposit.status = "partially_retained";
      }
    }

    let deposits = Array.from(depositsByLease.values());

    // Filtrer par statut si spécifié
    if (status) {
      deposits = deposits.filter((d) => d.status === status);
    }

    return NextResponse.json({
      success: true,
      data: deposits,
      meta: {
        count: deposits.length,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/accounting/deposits
 *
 * Body:
 * - lease_id: string (requis)
 * - operation_type: 'encaissement' | 'restitution' | 'retenue' (requis)
 * - amount: number (requis)
 * - date: string (optionnel, défaut: aujourd'hui)
 * - description: string (optionnel)
 * - deductions: array (optionnel, pour les retenues)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new ApiError(401, "Non authentifié");
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile) {
      throw new ApiError(404, "Profil non trouvé");
    }

    // Seuls les propriétaires et admins peuvent enregistrer des opérations
    if (profile.role !== "owner" && profile.role !== "admin") {
      throw new ApiError(403, "Seuls les propriétaires peuvent gérer les dépôts");
    }

    // Parser le body
    const body = await request.json();
    const {
      lease_id,
      operation_type,
      amount,
      date,
      description,
      deductions,
    } = body;

    // Validation
    if (!lease_id || !operation_type || !amount) {
      throw new ApiError(400, "lease_id, operation_type et amount sont requis");
    }

    const validTypes = ["encaissement", "restitution", "retenue"];
    if (!validTypes.includes(operation_type)) {
      throw new ApiError(400, "operation_type invalide");
    }

    if (amount <= 0) {
      throw new ApiError(400, "Le montant doit être positif");
    }

    // Récupérer le bail
    const { data: lease } = await supabase
      .from("leases")
      .select(`
        id,
        tenant_id,
        depot_de_garantie,
        property:properties!inner(owner_id)
      `)
      .eq("id", lease_id)
      .single();

    if (!lease) {
      throw new ApiError(404, "Bail non trouvé");
    }

    const propertyData = lease.property as any;

    // Vérifier les permissions
    if (profile.role === "owner" && propertyData?.owner_id !== profile.id) {
      throw new ApiError(403, "Ce bail ne vous appartient pas");
    }

    // Vérifications métier
    if (operation_type === "encaissement") {
      // Vérifier qu'on n'encaisse pas plus que le dépôt prévu
      const { data: existingOps } = await supabase
        .from("deposit_operations")
        .select("amount")
        .eq("lease_id", lease_id)
        .eq("operation_type", "encaissement");

      const totalEncaisse = (existingOps || []).reduce(
        (sum, op) => sum + op.amount,
        0
      );

      if (totalEncaisse + amount > (lease.depot_de_garantie || 0)) {
        throw new ApiError(
          400,
          `Le montant total encaissé (${totalEncaisse + amount}€) dépasse le dépôt prévu (${lease.depot_de_garantie}€)`
        );
      }
    }

    if (operation_type === "restitution" || operation_type === "retenue") {
      // Vérifier qu'il y a un solde disponible
      const { data: allOps } = await supabase
        .from("deposit_operations")
        .select("operation_type, amount")
        .eq("lease_id", lease_id);

      let balance = 0;
      for (const op of allOps || []) {
        if (op.operation_type === "encaissement") {
          balance += op.amount;
        } else {
          balance -= op.amount;
        }
      }

      if (amount > balance) {
        throw new ApiError(
          400,
          `Montant insuffisant. Solde disponible: ${balance}€`
        );
      }
    }

    const operationDate = date || new Date().toISOString().split("T")[0];

    // Enregistrer l'opération avec écritures comptables
    const accountingService = new AccountingIntegrationService(supabase);
    await accountingService.recordDepositOperation({
      tenantId: lease.tenant_id,
      leaseId: lease_id,
      operationType: operation_type,
      amount,
      date: operationDate,
      description: description || getDefaultDescription(operation_type, deductions),
    });

    // Si c'est une retenue, enregistrer les détails
    if (operation_type === "retenue" && deductions && deductions.length > 0) {
      // Les déductions seront stockées dans les métadonnées
      await supabase
        .from("deposit_operations")
        .update({
          metadata: { deductions },
        })
        .eq("lease_id", lease_id)
        .eq("operation_type", "retenue")
        .order("created_at", { ascending: false })
        .limit(1);
    }

    // Récupérer l'opération créée
    const { data: operation } = await supabase
      .from("deposit_operations")
      .select("*")
      .eq("lease_id", lease_id)
      .eq("operation_type", operation_type)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      data: operation,
      meta: {
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

function getDefaultDescription(
  type: string,
  deductions?: any[]
): string {
  switch (type) {
    case "encaissement":
      return "Encaissement dépôt de garantie à l'entrée";
    case "restitution":
      return "Restitution dépôt de garantie suite à la fin du bail";
    case "retenue":
      if (deductions && deductions.length > 0) {
        const total = deductions.reduce((sum, d) => sum + d.amount, 0);
        const motifs = deductions.map((d) => d.motif).join(", ");
        return `Retenue sur dépôt de garantie: ${motifs} (${total}€)`;
      }
      return "Retenue sur dépôt de garantie";
    default:
      return "";
  }
}
