export const runtime = 'nodejs';

/**
 * CRON Job: Génération mensuelle des factures/quittances
 * 
 * Ce job s'exécute le 1er de chaque mois à 6h00
 * Il génère automatiquement les factures pour tous les baux actifs
 * 
 * Résultat attendu:
 * - Toutes les factures du mois sont créées
 * - Les propriétaires reçoivent une notification
 * - Un email récapitulatif est envoyé
 */

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-client";
import { sendInvoiceNotification } from "@/lib/emails";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

// Vérifier que c'est bien un appel CRON (via secret)
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  
  // En dev, autoriser sans secret
  if (process.env.NODE_ENV === "development") {
    return true;
  }
  
  // Le job utilise ce header
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }
  
  return false;
}

interface LeaseForInvoice {
  id: string;
  loyer: number;
  charges_forfaitaires: number;
  properties: {
    id: string;
    adresse_complete: string;
    owner_id: string;
  };
  lease_signers: Array<{
    profile_id: string;
    role: string;
  }>;
}

interface GenerationResult {
  total_leases: number;
  invoices_created: number;
  invoices_skipped: number;
  errors: string[];
}

export async function GET(request: NextRequest) {
  console.log("[CRON] Starting monthly invoice generation...");
  
  // Vérifier l'autorisation
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const supabase = createServiceRoleClient();
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
  const result: GenerationResult = {
    total_leases: 0,
    invoices_created: 0,
    invoices_skipped: 0,
    errors: [],
  };
  
  try {
    // 1. Récupérer tous les baux actifs
    const { data: leases, error: leasesError } = await supabase
      .from("leases")
      .select(`
        id,
        loyer,
        charges_forfaitaires,
        properties!inner(
          id,
          adresse_complete,
          owner_id
        ),
        lease_signers(
          profile_id,
          role
        )
      `)
      .eq("statut", "active")
      .returns<LeaseForInvoice[]>();
    
    if (leasesError) {
      console.error("[CRON] Error fetching leases:", leasesError);
      throw new Error(`Erreur récupération baux: ${leasesError.message}`);
    }
    
    if (!leases || leases.length === 0) {
      console.log("[CRON] No active leases found");
      return NextResponse.json({
        success: true,
        message: "Aucun bail actif trouvé",
        result,
      });
    }
    
    result.total_leases = leases.length;
    console.log(`[CRON] Found ${leases.length} active leases`);
    
    // 2. Pour chaque bail, vérifier si une facture existe déjà pour ce mois
    for (const lease of leases) {
      try {
        // Vérifier si une facture existe déjà
        const { data: existingInvoice } = await supabase
          .from("invoices")
          .select("id")
          .eq("lease_id", lease.id)
          .eq("periode", currentMonth)
          .maybeSingle();
        
        if (existingInvoice) {
          console.log(`[CRON] Invoice already exists for lease ${lease.id}, skipping`);
          result.invoices_skipped++;
          continue;
        }
        
        // Trouver le locataire principal
        const tenantSigner = lease.lease_signers.find(
          (s) => s.role === "locataire_principal" || s.role === "colocataire"
        );
        
        if (!tenantSigner) {
          result.errors.push(`Bail ${lease.id}: Pas de locataire trouvé`);
          continue;
        }
        
        // Calculer les montants
        const loyerHC = Number(lease.loyer) || 0;
        const charges = Number(lease.charges_forfaitaires) || 0;
        const montantTotal = loyerHC + charges;
        
        // Calculer la date d'échéance (5 du mois courant)
        const dateEcheance = new Date(now.getFullYear(), now.getMonth(), 5);
        
        // Générer le numéro de facture
        const invoiceNumber = `QUI-${currentMonth.replace("-", "")}-${lease.id.slice(0, 8).toUpperCase()}`;
        
        // 3. Créer la facture
        const { data: newInvoice, error: createError } = await supabase
          .from("invoices")
          .insert({
            lease_id: lease.id,
            owner_id: lease.properties.owner_id,
            tenant_id: tenantSigner.profile_id,
            periode: currentMonth,
            montant_loyer: loyerHC,
            montant_charges: charges,
            montant_total: montantTotal,
            date_echeance: dateEcheance.toISOString().split("T")[0],
            statut: "sent",
            invoice_number: invoiceNumber,
            type: "loyer",
            description: `Loyer et charges - ${new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}`,
          })
          .select("id")
          .single();
        
        if (createError) {
          console.error(`[CRON] Error creating invoice for lease ${lease.id}:`, createError);
          result.errors.push(`Bail ${lease.id}: ${createError.message}`);
          continue;
        }
        
        console.log(`[CRON] Created invoice ${newInvoice.id} for lease ${lease.id}`);
        result.invoices_created++;
        
        // 4. Créer une notification pour le propriétaire
        await supabase.rpc("create_notification", {
          p_recipient_id: lease.properties.owner_id,
          p_type: "reminder",
          p_title: "Quittance générée",
          p_message: `La quittance de ${montantTotal}€ pour ${lease.properties.adresse_complete} a été générée.`,
          p_link: `/owner/money?invoice=${newInvoice.id}`,
          p_related_id: newInvoice.id,
          p_related_type: "invoice",
        });

        // 5. Envoyer l'email de notification au locataire
        try {
          // Récupérer les infos du locataire
          const { data: tenantProfile } = await supabase
            .from("profiles")
            .select("prenom, nom, user_id")
            .eq("id", tenantSigner.profile_id)
            .single();

          if (tenantProfile) {
            const { data: tenantAuth } = await supabase.auth.admin.getUserById(
              tenantProfile.user_id
            );

            if (tenantAuth?.user?.email) {
              const tenantName = `${tenantProfile.prenom || ""} ${tenantProfile.nom || ""}`.trim() || "Locataire";
              const periodLabel = format(
                new Date(now.getFullYear(), now.getMonth(), 1),
                "MMMM yyyy",
                { locale: fr }
              );

              await sendInvoiceNotification({
                tenantEmail: tenantAuth.user.email,
                tenantName,
                propertyAddress: lease.properties.adresse_complete || "Adresse non spécifiée",
                period: periodLabel,
                amount: montantTotal,
                dueDate: format(dateEcheance, "d MMMM yyyy", { locale: fr }),
                invoiceId: newInvoice.id,
              });
              console.log(`[CRON] Email de facture envoyé au locataire ${tenantAuth.user.email}`);
            }
          }
        } catch (emailError) {
          // Ne pas bloquer si l'email échoue
          console.error(`[CRON] Erreur envoi email facture pour bail ${lease.id}:`, emailError);
        }
        
      } catch (leaseError: any) {
        console.error(`[CRON] Error processing lease ${lease.id}:`, leaseError);
        result.errors.push(`Bail ${lease.id}: ${leaseError.message}`);
      }
    }
    
    // 5. Log le résultat
    console.log("[CRON] Monthly invoice generation completed:", result);
    
    // 6. Envoyer un email récapitulatif aux admins (optionnel)
    // await sendAdminRecapEmail(result);
    
    return NextResponse.json({
      success: true,
      message: `Génération terminée: ${result.invoices_created} factures créées, ${result.invoices_skipped} ignorées`,
      result,
      timestamp: now.toISOString(),
    });
    
  } catch (error: any) {
    console.error("[CRON] Fatal error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        result,
      },
      { status: 500 }
    );
  }
}

