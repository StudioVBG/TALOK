export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";
import { createServiceRoleClient } from "@/lib/supabase/server";

interface FinancialMetrics {
  totalRevenue: number;
  revenueGrowth: number;
  monthlyRevenue: number;
  averageRent: number;
  collectionRate: number;
  averagePaymentDelay: number;
  unpaidAmount: number;
  unpaidInvoices: number;
  totalDeposits: number;
  predictedRevenueNextMonth: number;
  riskScore: number;
  revenueHistory: { month: string; attendu: number; encaisse: number }[];
  paymentStats: { onTime: number; late: number; veryLate: number };
}

/**
 * GET /api/admin/people/owners/[id]/financials
 * Récupère les métriques financières d'un propriétaire pour le dashboard admin
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: ownerId } = await params;
    const { error, user } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Une erreur est survenue" },
        { status: error.status }
      );
    }

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // 1. Récupérer le profil pour obtenir le user_id
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, user_id")
      .eq("id", ownerId)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Propriétaire non trouvé" },
        { status: 404 }
      );
    }

    // 2. Récupérer les propriétés (essayer avec profile.id puis user_id)
    let { data: properties } = await supabase
      .from("properties")
      .select("id, loyer_actuel")
      .eq("owner_id", ownerId);

    if ((!properties || properties.length === 0) && profile.user_id) {
      const { data: propertiesByUserId } = await supabase
        .from("properties")
        .select("id, loyer_actuel")
        .eq("owner_id", profile.user_id);
      properties = propertiesByUserId;
    }

    const propertyIds = properties?.map(p => p.id) || [];

    // 3. Récupérer les baux actifs pour calculer les dépôts
    const { data: leases } = await supabase
      .from("leases")
      .select("id, loyer, depot_de_garantie, charges_forfaitaires, statut, property_id")
      .in("property_id", propertyIds.length > 0 ? propertyIds : ["00000000-0000-0000-0000-000000000000"]);

    const activeLeases = leases?.filter(l => l.statut === "active") || [];
    const leaseIds = leases?.map(l => l.id) || [];

    // 4. Récupérer les factures
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, montant_total, statut, periode, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });

    // Si pas de factures avec owner_id, essayer via les baux
    let allInvoices = invoices || [];
    if (allInvoices.length === 0 && leaseIds.length > 0) {
      const { data: invoicesByLease } = await supabase
        .from("invoices")
        .select("id, montant_total, statut, periode, created_at")
        .in("lease_id", leaseIds);
      allInvoices = invoicesByLease || [];
    }

    // 5. Récupérer les paiements
    const invoiceIds = allInvoices.map(i => i.id);
    const { data: payments } = await supabase
      .from("payments")
      .select("id, montant, statut, date_paiement, created_at, invoice_id")
      .in("invoice_id", invoiceIds.length > 0 ? invoiceIds : ["00000000-0000-0000-0000-000000000000"]);

    // Calculs des métriques
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Total des revenus (paiements réussis)
    const successfulPayments = payments?.filter(p => p.statut === "succeeded") || [];
    const totalRevenue = successfulPayments.reduce((sum, p) => sum + (p.montant || 0), 0);

    // Revenus du mois courant
    const currentMonthPayments = successfulPayments.filter(p => {
      const date = new Date(p.date_paiement || p.created_at);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });
    const monthlyRevenue = currentMonthPayments.reduce((sum, p) => sum + (p.montant || 0), 0);

    // Revenus du mois précédent (pour le calcul de croissance)
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastMonthPayments = successfulPayments.filter(p => {
      const date = new Date(p.date_paiement || p.created_at);
      return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
    });
    const lastMonthRevenue = lastMonthPayments.reduce((sum, p) => sum + (p.montant || 0), 0);
    const revenueGrowth = lastMonthRevenue > 0 
      ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 0;

    // Loyer moyen
    const rentValues = activeLeases.map(l => l.loyer || 0).filter(r => r > 0);
    const averageRent = rentValues.length > 0 
      ? Math.round(rentValues.reduce((a, b) => a + b, 0) / rentValues.length)
      : 0;

    // Impayés
    const unpaidInvoicesList = allInvoices.filter(i => i.statut === "late" || i.statut === "sent");
    const unpaidInvoices = unpaidInvoicesList.length;
    const unpaidAmount = unpaidInvoicesList.reduce((sum, i) => sum + (i.montant_total || 0), 0);

    // Taux de recouvrement
    const totalInvoiced = allInvoices.reduce((sum, i) => sum + (i.montant_total || 0), 0);
    const collectionRate = totalInvoiced > 0 
      ? Math.round((totalRevenue / totalInvoiced) * 100)
      : 100;

    // Délai moyen de paiement (en jours)
    const paymentDelays: number[] = [];
    successfulPayments.forEach(payment => {
      const invoice = allInvoices.find(i => i.id === payment.invoice_id);
      if (invoice) {
        const invoiceDate = new Date(invoice.created_at);
        const paymentDate = new Date(payment.date_paiement || payment.created_at);
        const delayDays = Math.floor((paymentDate.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24));
        if (delayDays >= 0 && delayDays < 365) {
          paymentDelays.push(delayDays);
        }
      }
    });
    const averagePaymentDelay = paymentDelays.length > 0
      ? Math.round(paymentDelays.reduce((a, b) => a + b, 0) / paymentDelays.length)
      : 0;

    // Dépôts de garantie
    const totalDeposits = activeLeases.reduce((sum, l) => sum + (l.depot_de_garantie || 0), 0);

    // Stats des paiements (à temps, en retard, impayés)
    const paidInvoices = allInvoices.filter(i => i.statut === "paid");
    const lateInvoices = allInvoices.filter(i => i.statut === "late");
    const sentInvoices = allInvoices.filter(i => i.statut === "sent");
    
    const paymentStats = {
      onTime: paidInvoices.length,
      late: lateInvoices.length,
      veryLate: sentInvoices.filter(i => {
        const created = new Date(i.created_at);
        const daysSince = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        return daysSince > 30;
      }).length,
    };

    // Historique des revenus sur 12 mois
    const revenueHistory: { month: string; attendu: number; encaisse: number }[] = [];
    const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
    
    for (let i = 11; i >= 0; i--) {
      const date = new Date(currentYear, currentMonth - i, 1);
      const month = date.getMonth();
      const year = date.getFullYear();
      const monthLabel = monthNames[month];
      
      // Factures attendues ce mois
      const monthInvoices = allInvoices.filter(inv => {
        const invDate = new Date(inv.created_at);
        return invDate.getMonth() === month && invDate.getFullYear() === year;
      });
      const attendu = monthInvoices.reduce((sum, i) => sum + (i.montant_total || 0), 0);
      
      // Paiements encaissés ce mois
      const monthPayments = successfulPayments.filter(p => {
        const pDate = new Date(p.date_paiement || p.created_at);
        return pDate.getMonth() === month && pDate.getFullYear() === year;
      });
      const encaisse = monthPayments.reduce((sum, p) => sum + (p.montant || 0), 0);
      
      revenueHistory.push({ month: monthLabel, attendu, encaisse });
    }

    // Prédiction du mois prochain (moyenne des 3 derniers mois)
    const last3Months = revenueHistory.slice(-3);
    const avgLast3 = last3Months.reduce((sum, m) => sum + m.encaisse, 0) / 3;
    const predictedRevenueNextMonth = Math.round(avgLast3 * (1 + revenueGrowth / 100));

    // Score de risque (0-100, plus c'est haut plus c'est risqué)
    let riskScore = 0;
    if (collectionRate < 70) riskScore += 40;
    else if (collectionRate < 85) riskScore += 20;
    else if (collectionRate < 95) riskScore += 10;
    
    if (unpaidInvoices >= 3) riskScore += 30;
    else if (unpaidInvoices >= 1) riskScore += 15;
    
    if (averagePaymentDelay > 15) riskScore += 20;
    else if (averagePaymentDelay > 7) riskScore += 10;
    
    riskScore = Math.min(100, riskScore);

    const metrics: FinancialMetrics = {
      totalRevenue,
      revenueGrowth,
      monthlyRevenue,
      averageRent,
      collectionRate,
      averagePaymentDelay,
      unpaidAmount,
      unpaidInvoices,
      totalDeposits,
      predictedRevenueNextMonth,
      riskScore,
      revenueHistory,
      paymentStats,
    };

    return NextResponse.json(metrics);
  } catch (error: unknown) {
    console.error("[GET /api/admin/people/owners/[id]/financials]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

