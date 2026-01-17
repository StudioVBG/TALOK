import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * API SOTA 2026: Calcul du Credit Score Locataire
 * 
 * Le score est calculé sur une échelle de 300 à 850 (standard FICO) basé sur:
 * - Historique des paiements de loyer (40%)
 * - Ancienneté du bail (20%)
 * - Documents fournis complets (20%)
 * - Absence d'incidents (20%)
 */

interface CreditScoreResponse {
  score: number;
  level: "poor" | "fair" | "good" | "excellent";
  change: number; // Variation ce mois
  factors: {
    paymentHistory: number;
    leaseHistory: number;
    documents: number;
    incidents: number;
  };
  hasData: boolean;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "tenant") {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Vérifier si le locataire a un bail actif
    const { data: leaseSigners } = await supabase
      .from("lease_signers")
      .select(`
        id,
        lease:leases!inner(
          id,
          statut,
          date_debut,
          loyer,
          created_at
        )
      `)
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"]);

    // Filtrer les baux actifs
    const activeLeases = leaseSigners?.filter(
      (ls: any) => ls.lease?.statut === "active" || ls.lease?.statut === "fully_signed"
    ) || [];

    // Si pas de bail actif, retourner hasData: false
    if (activeLeases.length === 0) {
      return NextResponse.json({
        score: 0,
        level: "poor",
        change: 0,
        factors: {
          paymentHistory: 0,
          leaseHistory: 0,
          documents: 0,
          incidents: 0,
        },
        hasData: false,
      } as CreditScoreResponse);
    }

    const currentLease = activeLeases[0].lease;
    const leaseId = currentLease.id;

    // 1. Historique des paiements (40% du score max = 220 points)
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, statut, date_echeance, paid_at")
      .eq("lease_id", leaseId)
      .order("date_echeance", { ascending: false });

    let paymentScore = 0;
    const totalInvoices = invoices?.length || 0;
    const paidOnTime = invoices?.filter((inv: any) => {
      if (inv.statut !== "paid") return false;
      if (!inv.paid_at || !inv.date_echeance) return true;
      return new Date(inv.paid_at) <= new Date(inv.date_echeance);
    }).length || 0;

    if (totalInvoices > 0) {
      paymentScore = Math.round((paidOnTime / totalInvoices) * 220);
    } else {
      // Pas encore de factures = score neutre
      paymentScore = 110; // 50% du max
    }

    // 2. Ancienneté du bail (20% = 110 points)
    const leaseStart = new Date(currentLease.date_debut);
    const monthsActive = Math.floor(
      (Date.now() - leaseStart.getTime()) / (1000 * 60 * 60 * 24 * 30)
    );
    // Max points après 24 mois
    const leaseScore = Math.min(110, Math.round((monthsActive / 24) * 110));

    // 3. Documents fournis (20% = 110 points)
    const { data: documents } = await supabase
      .from("documents")
      .select("id, type")
      .eq("tenant_id", profile.id);

    const requiredDocTypes = ["attestation_assurance", "justificatif_domicile", "piece_identite"];
    const providedDocs = documents?.filter((d: any) => requiredDocTypes.includes(d.type)).length || 0;
    const documentsScore = Math.round((Math.min(providedDocs, 3) / 3) * 110);

    // 4. Absence d'incidents (20% = 110 points)
    const { data: incidents } = await supabase
      .from("tickets")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("priorite", "haute");

    const incidentCount = incidents?.length || 0;
    const incidentScore = Math.max(0, 110 - incidentCount * 20);

    // Score total (base 300 + points gagnés)
    const totalScore = 300 + paymentScore + leaseScore + documentsScore + incidentScore;
    const finalScore = Math.min(850, Math.max(300, totalScore));

    // Déterminer le niveau
    let level: "poor" | "fair" | "good" | "excellent";
    if (finalScore >= 750) level = "excellent";
    else if (finalScore >= 650) level = "good";
    else if (finalScore >= 550) level = "fair";
    else level = "poor";

    // Calculer le changement (simplifié - basé sur le dernier paiement)
    const lastInvoice = invoices?.[0];
    let change = 0;
    if (lastInvoice?.statut === "paid") {
      change = 12; // Bonus pour paiement récent
    } else if (lastInvoice?.statut === "late") {
      change = -15; // Malus pour retard
    }

    return NextResponse.json({
      score: finalScore,
      level,
      change,
      factors: {
        paymentHistory: Math.round((paymentScore / 220) * 100),
        leaseHistory: Math.round((leaseScore / 110) * 100),
        documents: Math.round((documentsScore / 110) * 100),
        incidents: Math.round((incidentScore / 110) * 100),
      },
      hasData: true,
    } as CreditScoreResponse);
  } catch (error: unknown) {
    console.error("[CreditScore API] Erreur:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

