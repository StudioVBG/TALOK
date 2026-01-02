/**
 * Owner Finance Service - SOTA 2026
 * Logique métier pour la finance propriétaire : taxes, rendements, DROM.
 */

import { calculateTaxes } from "@/lib/services/tax-engine";
import { createClient } from "@/lib/supabase/server";

export interface PropertyPerformance {
  id: string;
  name: string;
  grossYield: number;
  netYield: number;
  cashflow: number;
}

/**
 * Calcule la rentabilité d'un bien en tenant compte des taxes DROM
 */
export async function getPropertyPerformance(propertyId: string): Promise<PropertyPerformance> {
  const supabase = await createClient();
  
  // 1. Récupérer les données du bien (loyer, charges, prix d'achat)
  const { data: property, error } = await supabase
    .from("properties")
    .select(`
      id, 
      nom, 
      adresse, 
      code_postal,
      investment_price,
      leases (
        loyer,
        charges_forfaitaires
      )
    `)
    .eq("id", propertyId)
    .single();

  if (error || !property) {
    throw new Error("Property not found");
  }

  const activeLease = property.leases?.[0]; // On prend le premier bail actif
  const monthlyRent = activeLease?.loyer || 0;
  const purchasePrice = (property as any).investment_price || 0;
  
  // 2. Calculer les taxes via le moteur fiscal
  const taxResult = calculateTaxes(monthlyRent, property.code_postal || "75000");
  
  // 3. Calculs financiers
  const annualRent = monthlyRent * 12;
  const grossYield = purchasePrice > 0 ? (annualRent / purchasePrice) * 100 : 0;
  
  // Pour le net, on retire la TVA (si refacturable) et une estimation de charges (20%)
  const annualNetRent = (taxResult.totalAmount - taxResult.tvaAmount) * 12 * 0.8;
  const netYield = purchasePrice > 0 ? (annualNetRent / purchasePrice) * 100 : 0;
  
  return {
    id: property.id,
    name: property.nom || "Bien sans nom",
    grossYield: Number(grossYield.toFixed(2)),
    netYield: Number(netYield.toFixed(2)),
    cashflow: Number((annualNetRent / 12).toFixed(2)),
  };
}

/**
 * Génère un rapport fiscal prévisionnel (DROM compatible)
 */
export async function generateTaxReport(ownerId: string, year: number) {
  // À implémenter : agrégation des factures et application des taux DROM par zone
  return {
    year,
    ownerId,
    totalRevenue: 0,
    totalTvaCollected: 0,
    status: "draft"
  };
}

