/**
 * Tools d'Action pour l'Assistant IA
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 * 
 * Ces tools permettent à l'assistant d'effectuer des actions
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type {
  TicketCreationResult,
  NotificationResult,
  DocumentGenerationResult,
  InvoiceCreationResult,
} from "../types";

// ============================================
// CREATE TICKET TOOL
// ============================================

export const createTicketTool = tool(
  async (input): Promise<TicketCreationResult> => {
    console.log("[Assistant Tool] Creating ticket:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Vérifier les permissions
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, message: "Non authentifié" };
    }
    
    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) {
      return { success: false, message: "Profil non trouvé" };
    }
    
    // Créer le ticket
    const { data: ticket, error } = await supabase
      .from("tickets")
      .insert({
        titre: input.title,
        description: input.description,
        priorite: input.priority || "normale",
        property_id: input.propertyId,
        created_by_profile_id: profile.id,
        statut: "open",
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("[Assistant Tool] Error creating ticket:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }
    
    return {
      success: true,
      ticketId: ticket.id,
      message: `Ticket créé avec succès (ID: ${ticket.id})`,
    };
  },
  {
    name: "create_ticket",
    description: "Crée un nouveau ticket de maintenance. Utilisez cet outil quand un locataire signale un problème ou qu'un propriétaire veut créer une demande d'intervention.",
    schema: z.object({
      title: z.string().describe("Titre court du problème (ex: 'Fuite d'eau cuisine')"),
      description: z.string().describe("Description détaillée du problème"),
      priority: z.enum(["basse", "normale", "haute"]).optional().default("normale").describe("Priorité du ticket"),
      propertyId: z.string().describe("ID du bien concerné"),
    }),
  }
);

// ============================================
// SEND NOTIFICATION TOOL
// ============================================

export const sendNotificationTool = tool(
  async (input): Promise<NotificationResult> => {
    console.log("[Assistant Tool] Sending notification:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Créer la notification
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        type: input.type || "custom",
        title: input.title,
        message: input.message,
        profile_id: input.recipientId,
        priority: input.priority || "normal",
        channels: ["in_app"],
        action_url: input.actionUrl,
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("[Assistant Tool] Error sending notification:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }
    
    return {
      success: true,
      notificationId: notification.id,
      message: "Notification envoyée avec succès",
    };
  },
  {
    name: "send_notification",
    description: "Envoie une notification à un utilisateur. Utilisez cet outil pour alerter un propriétaire ou un locataire.",
    schema: z.object({
      recipientId: z.string().describe("ID du profil destinataire"),
      title: z.string().describe("Titre de la notification"),
      message: z.string().describe("Message de la notification"),
      type: z.enum(["payment_due", "payment_late", "ticket_created", "ticket_updated", "message_received", "system", "custom"]).optional().describe("Type de notification"),
      priority: z.enum(["low", "normal", "high", "urgent"]).optional().describe("Priorité"),
      actionUrl: z.string().optional().describe("URL d'action (optionnel)"),
    }),
  }
);

// ============================================
// GENERATE RECEIPT TOOL
// ============================================

export const generateReceiptTool = tool(
  async (input): Promise<DocumentGenerationResult> => {
    console.log("[Assistant Tool] Generating receipt:", input);
    
    // Note: Cette fonction utiliserait le service de génération de PDF
    // Pour l'instant, on simule la génération
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Vérifier que la facture existe et est payée
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", input.invoiceId)
      .single();
    
    if (invoiceError || !invoice) {
      return { success: false, message: "Facture non trouvée" };
    }
    
    if (invoice.statut !== "paid") {
      return { success: false, message: "La facture doit être payée pour générer une quittance" };
    }
    
    // TODO: Intégrer avec le service PDF réel
    // const pdfService = await import("@/lib/pdf/generator");
    // const result = await pdfService.generateReceipt(invoice);
    
    return {
      success: true,
      message: `Quittance générée pour la période ${invoice.periode}. La fonctionnalité complète sera disponible prochainement.`,
    };
  },
  {
    name: "generate_receipt",
    description: "Génère une quittance de loyer pour une facture payée. Utilisez cet outil quand un locataire demande sa quittance.",
    schema: z.object({
      invoiceId: z.string().describe("ID de la facture payée"),
    }),
  }
);

// ============================================
// CREATE INVOICE TOOL
// ============================================

export const createInvoiceTool = tool(
  async (input): Promise<InvoiceCreationResult> => {
    console.log("[Assistant Tool] Creating invoice:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Récupérer le bail
    const { data: lease, error: leaseError } = await supabase
      .from("leases")
      .select(`
        id,
        loyer,
        charges_forfaitaires,
        property_id,
        tenant_id,
        owner_id
      `)
      .eq("id", input.leaseId)
      .single();
    
    if (leaseError || !lease) {
      return { success: false, message: "Bail non trouvé" };
    }
    
    // Calculer le montant
    const montantLoyer = input.amount || lease.loyer;
    const montantCharges = input.charges || lease.charges_forfaitaires || 0;
    const montantTotal = montantLoyer + montantCharges;
    
    // Créer la facture
    const { data: invoice, error } = await supabase
      .from("invoices")
      .insert({
        lease_id: lease.id,
        property_id: lease.property_id,
        tenant_id: lease.tenant_id,
        owner_id: lease.owner_id,
        periode: input.period,
        montant_loyer: montantLoyer,
        montant_charges: montantCharges,
        montant_total: montantTotal,
        date_echeance: input.dueDate,
        statut: "draft",
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("[Assistant Tool] Error creating invoice:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }
    
    return {
      success: true,
      invoiceId: invoice.id,
      message: `Facture créée pour ${montantTotal}€ (loyer: ${montantLoyer}€, charges: ${montantCharges}€)`,
    };
  },
  {
    name: "create_invoice",
    description: "Crée une nouvelle facture de loyer. Utilisez cet outil pour générer une facture pour un bail.",
    schema: z.object({
      leaseId: z.string().describe("ID du bail"),
      period: z.string().describe("Période de la facture (ex: '2025-12')"),
      dueDate: z.string().describe("Date d'échéance (YYYY-MM-DD)"),
      amount: z.number().optional().describe("Montant du loyer (optionnel, utilise le loyer du bail par défaut)"),
      charges: z.number().optional().describe("Montant des charges (optionnel)"),
    }),
  }
);

// ============================================
// SCHEDULE VISIT TOOL
// ============================================

export const scheduleVisitTool = tool(
  async (input): Promise<NotificationResult> => {
    console.log("[Assistant Tool] Scheduling visit:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Pour l'instant, on crée une notification/rappel
    // TODO: Intégrer avec un vrai système de calendrier
    
    const { data: notification, error } = await supabase
      .from("notifications")
      .insert({
        type: "maintenance_scheduled",
        title: `Visite programmée: ${input.reason}`,
        message: `Visite prévue le ${input.date} à ${input.time} pour: ${input.reason}`,
        profile_id: input.tenantId,
        priority: "normal",
        channels: ["in_app", "email"],
        metadata: {
          visitDate: input.date,
          visitTime: input.time,
          propertyId: input.propertyId,
          reason: input.reason,
        },
      })
      .select("id")
      .single();
    
    if (error) {
      console.error("[Assistant Tool] Error scheduling visit:", error);
      return { success: false, message: `Erreur: ${error.message}` };
    }
    
    return {
      success: true,
      notificationId: notification.id,
      message: `Visite programmée le ${input.date} à ${input.time}. Le locataire a été notifié.`,
    };
  },
  {
    name: "schedule_visit",
    description: "Programme une visite pour un bien (état des lieux, maintenance, etc.). Utilisez cet outil pour planifier une intervention.",
    schema: z.object({
      propertyId: z.string().describe("ID du bien"),
      tenantId: z.string().describe("ID du profil du locataire à notifier"),
      date: z.string().describe("Date de la visite (YYYY-MM-DD)"),
      time: z.string().describe("Heure de la visite (HH:MM)"),
      reason: z.string().describe("Raison de la visite (ex: 'État des lieux de sortie', 'Intervention plombier')"),
    }),
  }
);

// ============================================
// GET RENT SUMMARY TOOL
// ============================================

export const getRentSummaryTool = tool(
  async (input): Promise<{ summary: string; details: Record<string, unknown> }> => {
    console.log("[Assistant Tool] Getting rent summary:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    // Récupérer les factures pour la période
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        statut,
        date_echeance,
        date_paiement,
        periode
      `)
      .eq("owner_id", input.ownerId)
      .gte("periode", input.fromPeriod || "2025-01")
      .lte("periode", input.toPeriod || "2025-12");
    
    if (error) {
      console.error("[Assistant Tool] Error getting rent summary:", error);
      return { summary: "Erreur lors de la récupération des données", details: {} };
    }
    
    const total = invoices?.reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
    const paid = invoices?.filter(inv => inv.statut === "paid").reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
    const pending = invoices?.filter(inv => inv.statut === "sent" || inv.statut === "draft").reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
    const late = invoices?.filter(inv => inv.statut === "late").reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
    
    const summary = `
📊 Résumé des loyers (${input.fromPeriod || "2025-01"} à ${input.toPeriod || "2025-12"}):
- Total attendu: ${total.toLocaleString("fr-FR")}€
- Encaissé: ${paid.toLocaleString("fr-FR")}€ (${Math.round(paid/total*100) || 0}%)
- En attente: ${pending.toLocaleString("fr-FR")}€
- En retard: ${late.toLocaleString("fr-FR")}€
- Factures: ${invoices?.length || 0}
    `.trim();
    
    return {
      summary,
      details: {
        total,
        paid,
        pending,
        late,
        invoiceCount: invoices?.length || 0,
        collectionRate: total > 0 ? Math.round(paid / total * 100) : 0,
      },
    };
  },
  {
    name: "get_rent_summary",
    description: "Obtient un résumé des loyers pour une période. Utilisez cet outil pour avoir une vue d'ensemble des revenus locatifs.",
    schema: z.object({
      ownerId: z.string().describe("ID du propriétaire"),
      fromPeriod: z.string().optional().describe("Période de début (YYYY-MM)"),
      toPeriod: z.string().optional().describe("Période de fin (YYYY-MM)"),
    }),
  }
);

// ============================================
// EXPORT ALL ACTION TOOLS
// ============================================

export const actionTools = [
  createTicketTool,
  sendNotificationTool,
  generateReceiptTool,
  createInvoiceTool,
  scheduleVisitTool,
  getRentSummaryTool,
];

export default actionTools;

