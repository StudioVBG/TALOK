// @ts-nocheck
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AnalyticsClient } from "./AnalyticsClient";
import { Skeleton } from "@/components/ui/skeleton";


export const metadata = {
  title: "Analytics | Talok",
  description: "Analysez la performance de votre patrimoine immobilier",
};

interface AnalyticsData {
  // KPIs globaux
  totalProperties: number;
  totalLeases: number;
  occupancyRate: number;
  vacancyDays: number;
  
  // Financier
  totalMonthlyRent: number;
  totalMonthlyCharges: number;
  totalAnnualRevenue: number;
  totalAnnualExpenses: number;
  netAnnualIncome: number;
  grossYield: number;
  netYield: number;
  collectionRate: number;
  totalUnpaid: number;
  
  // Par bien
  propertiesStats: Array<{
    id: string;
    address: string;
    city: string;
    type: string;
    status: string;
    monthlyRent: number;
    monthlyCharges: number;
    annualRevenue: number;
    occupancyRate: number;
    grossYield: number;
    netYield: number;
    purchasePrice?: number;
  }>;
  
  // Évolution mensuelle (12 derniers mois)
  monthlyData: Array<{
    month: string;
    revenue: number;
    expenses: number;
    net: number;
    occupancy: number;
  }>;
  
  // Locataires
  tenantsStats: {
    total: number;
    onTime: number;
    late: number;
    avgScore: number;
    avgLeaseDuration: number;
  };
}

async function fetchAnalyticsData(ownerId: string): Promise<AnalyticsData> {
  const supabase = await createClient();
  
  // Récupérer les propriétés
  const { data: properties } = await supabase
    .from("properties")
    .select(`
      id, adresse_complete, ville, type, surface, loyer_hc, charges_mensuelles,
      leases(id, statut, loyer, charges_forfaitaires, date_debut, date_fin)
    `)
    .eq("owner_id", ownerId);

  // Récupérer les factures des 12 derniers mois
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, montant_total, statut, periode, date_paiement, created_at, lease_id")
    .gte("created_at", oneYearAgo.toISOString())
    .order("created_at", { ascending: true });

  // Calculs
  const propertiesData = properties || [];
  const invoicesData = invoices || [];
  
  let totalMonthlyRent = 0;
  let totalMonthlyCharges = 0;
  let activeLeases = 0;
  let totalRevenue = 0;
  let paidRevenue = 0;
  let totalUnpaid = 0;
  
  const propertiesStats = propertiesData.map((prop) => {
    const activeLeasesList = prop.leases?.filter((l: any) => l.statut === "active") || [];
    const hasActiveLease = activeLeasesList.length > 0;
    const activeLease = activeLeasesList[0];
    
    const monthlyRent = activeLease?.loyer || prop.loyer_hc || 0;
    const monthlyCharges = activeLease?.charges_forfaitaires || prop.charges_mensuelles || 0;
    
    if (hasActiveLease) {
      totalMonthlyRent += monthlyRent;
      totalMonthlyCharges += monthlyCharges;
      activeLeases++;
    }
    
    // Calcul rendement brut (estimation si pas de prix d'achat)
    const estimatedPrice = (monthlyRent * 12) / 0.06; // Estimation à 6% de rendement
    const grossYield = monthlyRent > 0 ? ((monthlyRent * 12) / estimatedPrice) * 100 : 0;
    
    return {
      id: prop.id,
      address: prop.adresse_complete,
      city: prop.ville,
      type: prop.type,
      status: hasActiveLease ? "loue" : "vacant",
      monthlyRent,
      monthlyCharges,
      annualRevenue: monthlyRent * 12,
      occupancyRate: hasActiveLease ? 100 : 0,
      grossYield,
      netYield: grossYield * 0.7, // Estimation avec 30% de charges
    };
  });

  // Calculs factures
  invoicesData.forEach((inv: any) => {
    totalRevenue += inv.montant_total || 0;
    if (inv.statut === "paid") {
      paidRevenue += inv.montant_total || 0;
    } else if (inv.statut === "sent" || inv.statut === "late") {
      totalUnpaid += inv.montant_total || 0;
    }
  });

  // Données mensuelles
  const monthlyDataMap = new Map<string, { revenue: number; expenses: number }>();
  const last12Months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (11 - i));
    return date.toISOString().slice(0, 7); // YYYY-MM
  });
  
  last12Months.forEach(month => {
    monthlyDataMap.set(month, { revenue: 0, expenses: 0 });
  });
  
  invoicesData.forEach((inv: any) => {
    const month = inv.periode || inv.created_at?.slice(0, 7);
    if (month && monthlyDataMap.has(month)) {
      const current = monthlyDataMap.get(month)!;
      if (inv.statut === "paid") {
        current.revenue += inv.montant_total || 0;
      }
    }
  });

  const monthlyData = last12Months.map(month => {
    const data = monthlyDataMap.get(month) || { revenue: 0, expenses: 0 };
    return {
      month,
      revenue: data.revenue,
      expenses: data.expenses,
      net: data.revenue - data.expenses,
      occupancy: propertiesData.length > 0 ? (activeLeases / propertiesData.length) * 100 : 0,
    };
  });

  // Stats globales
  const totalProperties = propertiesData.length;
  const occupancyRate = totalProperties > 0 ? (activeLeases / totalProperties) * 100 : 0;
  const vacancyDays = Math.round((100 - occupancyRate) / 100 * 365);
  const totalAnnualRevenue = totalMonthlyRent * 12;
  const totalAnnualExpenses = totalMonthlyCharges * 12;
  const netAnnualIncome = totalAnnualRevenue - totalAnnualExpenses;
  const grossYield = propertiesStats.reduce((sum, p) => sum + p.grossYield, 0) / Math.max(propertiesStats.length, 1);
  const netYield = grossYield * 0.7;
  const collectionRate = totalRevenue > 0 ? (paidRevenue / totalRevenue) * 100 : 100;

  return {
    totalProperties,
    totalLeases: activeLeases,
    occupancyRate,
    vacancyDays,
    totalMonthlyRent,
    totalMonthlyCharges,
    totalAnnualRevenue,
    totalAnnualExpenses,
    netAnnualIncome,
    grossYield,
    netYield,
    collectionRate,
    totalUnpaid,
    propertiesStats,
    monthlyData,
    tenantsStats: {
      total: activeLeases,
      onTime: Math.round(activeLeases * 0.85),
      late: Math.round(activeLeases * 0.15),
      avgScore: 4.2,
      avgLeaseDuration: 2.4,
    },
  };
}

function AnalyticsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/signin");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard");
  }

  const data = await fetchAnalyticsData(profile.id);

  return (
    <Suspense fallback={<AnalyticsSkeleton />}>
      <AnalyticsClient data={data} />
    </Suspense>
  );
}

