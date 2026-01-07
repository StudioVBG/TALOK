export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/owner/dashboard - Récupérer les données du dashboard propriétaire V2
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Récupérer le profil propriétaire
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.role !== "owner") {
      return NextResponse.json(
        { error: "Accès réservé aux propriétaires" },
        { status: 403 }
      );
    }

    const ownerId = profile.id;

    // 1. Récupérer les propriétés (inclure type_bien pour support V3)
    const { data: properties } = await supabase
      .from("properties")
      .select("id, type, type_bien, adresse_complete, surface, nb_pieces")
      .eq("owner_id", ownerId);

    const propertyIds = (properties || []).map((p) => p.id);

    if (propertyIds.length === 0) {
      return NextResponse.json({
        zone1_tasks: [],
        zone2_finances: {
          chart_data: [],
          kpis: {
            revenue_current_month: {
              collected: 0,
              expected: 0,
              percentage: 0,
            },
            revenue_last_month: {
              collected: 0,
              expected: 0,
              percentage: 0,
            },
            arrears_amount: 0,
          },
        },
        zone3_portfolio: {
          modules: [],
          compliance: [],
          performance: null,
        },
      }, {
        headers: {
          'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=60'
        }
      });
    }

    // Préparer les dates pour les requêtes
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // 2-3. Paralléliser les requêtes pour améliorer les performances (gain ~30-40%)
    const [
      { data: leases },
      { data: invoices },
    ] = await Promise.all([
      // Récupérer les baux actifs
      supabase
        .from("leases")
        .select(`
          id,
          property_id,
          type_bail,
          loyer,
          charges_forfaitaires,
          date_debut,
          date_fin,
          statut,
          properties!inner(id, adresse_complete, type)
        `)
        .in("property_id", propertyIds)
        .in("statut", ["active", "pending_signature"]),
      // Récupérer les factures des 6 derniers mois
      supabase
        .from("invoices")
        .select("id, lease_id, periode, montant_total, statut, montant_loyer, montant_charges")
        .eq("owner_id", ownerId)
        .gte("periode", sixMonthsAgo.toISOString().slice(0, 7)),
    ]);

    const leaseIds = (leases || []).map((l: any) => l.id);

    // 4. Récupérer les signataires en attente (après avoir les leaseIds)
    const { data: pendingSignatures } = leaseIds.length > 0
      ? await supabase
          .from("lease_signers")
          .select(`
            id,
            lease_id,
            role,
            signature_status,
            leases!inner(id, properties!inner(adresse_complete))
          `)
          .eq("signature_status", "pending")
          .in("lease_id", leaseIds)
      : { data: null };

    // 5. Calculer les impayés
    const unpaidInvoices = (invoices || []).filter(
      (inv) => inv.statut === "sent" || inv.statut === "draft"
    );

    const totalUnpaid = unpaidInvoices.reduce(
      (sum, inv) => sum + Number(inv.montant_total || 0),
      0
    );

    // Calculer le retard moyen (simplifié)
    const today = new Date();
    const overdueDays = unpaidInvoices.map((inv) => {
      const invoiceDate = new Date(inv.periode + "-01");
      const daysDiff = Math.floor(
        (today.getTime() - invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysDiff > 0 ? daysDiff : 0;
    });
    const avgDays = overdueDays.length > 0
      ? Math.round(overdueDays.reduce((a, b) => a + b, 0) / overdueDays.length)
      : 0;

    // 6. Calculer les revenus du mois en cours
    const currentMonthInvoices = (invoices || []).filter(
      (inv) => inv.periode === currentMonth
    );
    const expectedThisMonth = currentMonthInvoices.reduce(
      (sum, inv) => sum + Number(inv.montant_total || 0),
      0
    );
    const collectedThisMonth = currentMonthInvoices
      .filter((inv) => inv.statut === "paid")
      .reduce((sum, inv) => sum + Number(inv.montant_total || 0), 0);

    // 7. Calculer l'évolution vs mois dernier
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const lastMonthStr = lastMonth.toISOString().slice(0, 7);
    const lastMonthInvoices = (invoices || []).filter(
      (inv) => inv.periode === lastMonthStr
    );
    const expectedLastMonth = lastMonthInvoices.reduce(
      (sum, inv) => sum + Number(inv.montant_total || 0),
      0
    );
    const collectedLastMonth = lastMonthInvoices
      .filter((inv) => inv.statut === "paid")
      .reduce((sum, inv) => sum + Number(inv.montant_total || 0), 0);
    const evolution = collectedLastMonth > 0
      ? Math.round(((collectedThisMonth - collectedLastMonth) / collectedLastMonth) * 100)
      : 0;

    // 8. Préparer les données du graphique (6 derniers mois)
    const chartData = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const period = date.toISOString().slice(0, 7);
      const periodInvoices = (invoices || []).filter((inv) => inv.periode === period);
      const expected = periodInvoices.reduce(
        (sum, inv) => sum + Number(inv.montant_total || 0),
        0
      );
      const collected = periodInvoices
        .filter((inv) => inv.statut === "paid")
        .reduce((sum, inv) => sum + Number(inv.montant_total || 0), 0);

      chartData.push({
        period,
        expected,
        collected,
      });
    }

    // 9. Zone 1 - Tâches à faire (format conforme aux nouveaux composants)
    const tasks: Array<{
      id: string;
      type: "rent_arrears" | "sign_contracts" | "indexation" | "lease_end" | "compliance";
      priority: "high" | "medium" | "low";
      label: string;
      count?: number;
      total_amount?: number;
      action_url: string;
    }> = [];

    // Relances & impayés
    if (unpaidInvoices.length > 0) {
      const uniqueLeases = new Set(unpaidInvoices.map((inv) => inv.lease_id));
      tasks.push({
        id: "rent_arrears",
        type: "rent_arrears",
        priority: "high",
        label: `Relancer ${uniqueLeases.size} locataire${uniqueLeases.size > 1 ? "s" : ""}`,
        count: uniqueLeases.size,
        total_amount: totalUnpaid,
        action_url: "/owner/money?filter=arrears",
      });
    }

    // Signatures en attente
    if (pendingSignatures && pendingSignatures.length > 0) {
      const uniqueLeases = new Set(pendingSignatures.map((s: any) => s.lease_id));
      tasks.push({
        id: "sign_contracts",
        type: "sign_contracts",
        priority: "high",
        label: `Signer ${uniqueLeases.size} bail${uniqueLeases.size > 1 ? "x" : ""} en attente`,
        count: uniqueLeases.size,
        action_url: "/owner/leases?filter=status:draft_or_to_sign",
      });
    }

    // Fins de bail à préparer (dans les 3 prochains mois)
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    const endingLeases = (leases || []).filter((l: any) => {
      if (!l.date_fin) return false;
      const endDate = new Date(l.date_fin);
      return endDate <= threeMonthsFromNow && endDate >= new Date();
    });
    if (endingLeases.length > 0) {
      tasks.push({
        id: "lease_end",
        type: "lease_end",
        priority: "medium",
        label: `Préparer ${endingLeases.length} fin${endingLeases.length > 1 ? "s" : ""} de bail à venir`,
        count: endingLeases.length,
        action_url: "/owner/leases?filter=lease_end:3months",
      });
    }

    // 10. Zone 3 - Portefeuille par module (format conforme aux nouveaux composants)
    const modules: Array<{
      module: "habitation" | "lcd" | "pro" | "parking";
      label: string;
      stats: {
        active_leases?: number;
        monthly_revenue?: number;
        occupancy_rate?: number;
        nights_sold?: number;
        revenue?: number;
        properties_count?: number;
      };
      action_url: string;
    }> = [];

    // Habitation & colocation - Support V3 (type_bien) et Legacy (type)
    const habitationLeases = (leases || []).filter(
      (l: any) =>
        l.type_bail === "nu" ||
        l.type_bail === "meuble" ||
        l.type_bail === "colocation"
    );
    const habitationProperties = (properties || []).filter(
      (p: any) => {
        const propertyType = p.type_bien || p.type; // Priorité à type_bien (V3)
        return propertyType === "appartement" ||
               propertyType === "maison" ||
               propertyType === "colocation";
      }
    );
    if (habitationLeases.length > 0 || habitationProperties.length > 0) {
      const totalRent = habitationLeases.reduce(
        (sum: number, l: any) => sum + Number(l.loyer || 0) + Number(l.charges_forfaitaires || 0),
        0
      );
      const activeCount = habitationLeases.filter(
        (l: any) => l.statut === "active"
      ).length;
      const occupancyRate = habitationLeases.length > 0
        ? Math.round((activeCount / habitationLeases.length) * 100)
        : 0;

      modules.push({
        module: "habitation",
        label: "Habitation",
        stats: {
          active_leases: activeCount,
          monthly_revenue: totalRent,
          occupancy_rate: occupancyRate,
          properties_count: habitationProperties.length,
        },
        action_url: "/owner/properties?module=habitation",
      });
    }

    // LCD (Location Courte Durée / Saisonnier) - Support V3 et Legacy
    const lcdLeases = (leases || []).filter(
      (l: any) => l.type_bail === "saisonnier"
    );
    const lcdProperties = (properties || []).filter(
      (p: any) => {
        const propertyType = p.type_bien || p.type;
        return propertyType === "saisonnier";
      }
    );
    if (lcdLeases.length > 0 || lcdProperties.length > 0) {
      // Pour LCD, on peut calculer les nuits vendues et le CA si on a des données de réservations
      // Pour l'instant, on utilise les revenus mensuels des baux saisonniers
      const totalRevenue = lcdLeases.reduce(
        (sum: number, l: any) => sum + Number(l.loyer || 0) + Number(l.charges_forfaitaires || 0),
        0
      );

      modules.push({
        module: "lcd",
        label: "Location Courte Durée",
        stats: {
          active_leases: lcdLeases.filter((l: any) => l.statut === "active").length,
          monthly_revenue: totalRevenue,
          properties_count: lcdProperties.length,
          nights_sold: 0, // TODO: Calculer depuis les réservations si table existe
          revenue: totalRevenue,
        },
        action_url: "/owner/properties?module=lcd",
      });
    }

    // Pro & commerces - Support V3 et Legacy
    const proLeases = (leases || []).filter(
      (l: any) => l.type_bail === "commercial" || l.type_bail === "professionnel"
    );
    const proProperties = (properties || []).filter(
      (p: any) => {
        const propertyType = p.type_bien || p.type;
        return propertyType === "local_commercial" ||
               propertyType === "bureaux" ||
               propertyType === "entrepot" ||
               propertyType === "fonds_de_commerce";
      }
    );
    if (proLeases.length > 0 || proProperties.length > 0) {
      const totalRent = proLeases.reduce(
        (sum: number, l: any) => sum + Number(l.loyer || 0),
        0
      );
      modules.push({
        module: "pro",
        label: "Pro & commerces",
        stats: {
          active_leases: proLeases.filter((l: any) => l.statut === "active").length,
          monthly_revenue: totalRent,
          properties_count: proProperties.length,
        },
        action_url: "/owner/properties?module=pro",
      });
    }

    // Parking - Support V3 et Legacy
    const parkingLeases = (leases || []).filter(
      (l: any) => l.type_bail === "parking_seul"
    );
    const parkingProperties = (properties || []).filter(
      (p: any) => {
        const propertyType = p.type_bien || p.type;
        return propertyType === "parking" || propertyType === "box";
      }
    );
    if (parkingLeases.length > 0 || parkingProperties.length > 0) {
      const totalRent = parkingLeases.reduce(
        (sum: number, l: any) => sum + Number(l.loyer || 0),
        0
      );
      modules.push({
        module: "parking",
        label: "Parking",
        stats: {
          active_leases: parkingLeases.filter((l: any) => l.statut === "active").length,
          monthly_revenue: totalRent,
          properties_count: parkingProperties.length,
        },
        action_url: "/owner/properties?module=parking",
      });
    }

    // 11. Conformité & risques (format conforme aux nouveaux composants)
    const compliance: Array<{
      id: string;
      type: "dpe_expiring" | "lease_end" | "indexation_due" | "tax_declaration" | "compliance";
      severity: "high" | "medium" | "low";
      label: string;
      action_url: string;
    }> = [];

    // Baux avec date de fin proche
    endingLeases.forEach((lease: any) => {
      const endDate = new Date(lease.date_fin);
      const daysUntilEnd = Math.floor(
        (endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
      );
      compliance.push({
        id: `lease_end_${lease.id}`,
        type: "lease_end",
        severity: daysUntilEnd < 30 ? "high" : daysUntilEnd < 90 ? "medium" : "low",
        label: `Fin de bail ${lease.properties?.adresse_complete || ""} dans ${Math.ceil(daysUntilEnd / 30)} mois`,
        action_url: `/owner/leases/${lease.id}`,
      });
    });

    // DPE expirant (si date de DPE renseignée)
    const propertiesWithDPE = (properties || []).filter((p: any) => p.energie);
    
    // ✅ DPE: Vérifier les dates d'expiration DPE si colonne existe
    try {
      const { data: propertiesWithDPEDates } = await supabase
        .from("properties")
        .select("id, energie, dpe_date_expiration")
        .in("id", propertyIds)
        .not("dpe_date_expiration", "is", null);
      
      if (propertiesWithDPEDates && propertiesWithDPEDates.length > 0) {
        const today = new Date();
        propertiesWithDPEDates.forEach((p: any) => {
          if (p.dpe_date_expiration) {
            const expirationDate = new Date(p.dpe_date_expiration);
            const daysUntilExpiration = Math.floor(
              (expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );
            
            if (daysUntilExpiration > 0 && daysUntilExpiration <= 365) {
              compliance.push({
                id: `dpe_expiring_${p.id}`,
                type: "dpe_expiring",
                severity: daysUntilExpiration < 90 ? "high" : daysUntilExpiration < 180 ? "medium" : "low",
                label: `DPE expirant dans ${Math.ceil(daysUntilExpiration / 30)} mois`,
                action_url: `/owner/properties/${p.id}`,
              });
            }
          }
        });
      }
    } catch (dpeError) {
      // Ignorer si la colonne n'existe pas
      console.warn("[GET /api/owner/dashboard] DPE date check skipped:", dpeError);
    }

    // ✅ PERFORMANCE: Calculer ROI et rendement si prix d'achat renseigné
    let performance: {
      total_investment: number;
      total_monthly_revenue: number;
      annual_yield: number;
      roi: number;
    } | null = null;
    
    try {
      const { data: propertiesWithPrice } = await supabase
        .from("properties")
        .select("id, prix_achat, loyer_base")
        .in("id", propertyIds)
        .not("prix_achat", "is", null);
      
      if (propertiesWithPrice && propertiesWithPrice.length > 0) {
        const totalInvestment = propertiesWithPrice.reduce(
          (sum: number, p: any) => sum + Number(p.prix_achat || 0),
          0
        );
        const totalMonthlyRevenue = habitationLeases.reduce(
          (sum: number, l: any) => sum + Number(l.loyer || 0) + Number(l.charges_forfaitaires || 0),
          0
        );
        const annualRevenue = totalMonthlyRevenue * 12;
        const annualYield = totalInvestment > 0 
          ? Math.round((annualRevenue / totalInvestment) * 100 * 100) / 100 // Pourcentage avec 2 décimales
          : 0;
        
        // ROI simplifié (sur 10 ans)
        const roi = totalInvestment > 0
          ? Math.round(((annualRevenue * 10 - totalInvestment) / totalInvestment) * 100 * 100) / 100
          : 0;
        
        performance = {
          total_investment: totalInvestment,
          total_monthly_revenue: totalMonthlyRevenue,
          annual_yield: annualYield,
          roi,
        };
      }
    } catch (performanceError) {
      // Ignorer si la colonne n'existe pas
      console.warn("[GET /api/owner/dashboard] Performance calculation skipped:", performanceError);
    }

    return NextResponse.json({
      zone1_tasks: tasks.slice(0, 5), // Max 5 tâches
      zone2_finances: {
        chart_data: chartData,
        kpis: {
          revenue_current_month: {
            collected: collectedThisMonth,
            expected: expectedThisMonth,
            percentage: expectedThisMonth > 0
              ? Math.round((collectedThisMonth / expectedThisMonth) * 100)
              : 0,
          },
          revenue_last_month: {
            collected: collectedLastMonth,
            expected: expectedLastMonth,
            percentage: expectedLastMonth > 0
              ? Math.round((collectedLastMonth / expectedLastMonth) * 100)
              : 0,
          },
          arrears_amount: totalUnpaid,
        },
      },
      zone3_portfolio: {
        modules,
        compliance: compliance.slice(0, 5), // Max 5 risques
        performance,
      },
    }, {
      // Cache HTTP : 5 minutes pour le serveur, 1 minute stale-while-revalidate
      headers: {
        'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=60'
      }
    });
  } catch (error: any) {
    console.error("Error in GET /api/owner/dashboard:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}

