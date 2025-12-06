/**
 * Tools spécifiques pour les Locataires
 * SOTA Décembre 2025 - GPT-4o + LangGraph
 * 
 * Ces tools permettent aux locataires de :
 * - Consulter leur bail
 * - Voir leurs paiements
 * - Signaler des problèmes
 * - Demander des documents
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================
// GET MY LEASE - Consulter mon bail
// ============================================

export const getMyLeaseTool = tool(
  async (): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Tenant Tool] Getting my lease");
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) return { success: false, message: "Profil non trouvé" };
    
    // Récupérer les baux via lease_signers
    const { data: leaseSigners, error } = await supabase
      .from("lease_signers")
      .select(`
        role,
        lease:leases (
          id,
          type_bail,
          loyer,
          charges_forfaitaires,
          depot_garantie,
          date_debut,
          date_fin,
          statut,
          property:properties (
            adresse_complete,
            ville,
            code_postal,
            type_bien,
            surface,
            nb_pieces
          )
        )
      `)
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"]);
    
    if (error) {
      console.error("[Tenant Tool] Error getting lease:", error);
      return { success: false, message: "Erreur lors de la récupération du bail" };
    }
    
    // Filtrer les baux actifs
    const activeLeases = leaseSigners?.filter(ls => {
      const lease = ls.lease as Record<string, unknown> | null;
      return lease && lease.statut === "active";
    }) || [];
    
    if (activeLeases.length === 0) {
      return { 
        success: true, 
        data: null, 
        message: "📄 Aucun bail actif trouvé. Si tu viens d'emménager, ton propriétaire doit finaliser le bail." 
      };
    }
    
    const leaseData = activeLeases[0].lease as Record<string, unknown>;
    const property = leaseData.property as Record<string, unknown> | null;
    
    const loyerTotal = (leaseData.loyer as number || 0) + (leaseData.charges_forfaitaires as number || 0);
    
    return {
      success: true,
      data: leaseData,
      message: `📄 **Ton bail actif**

🏠 **Logement :**
- Adresse : ${property?.adresse_complete || "N/A"}
- Ville : ${property?.code_postal || ""} ${property?.ville || "N/A"}
- Type : ${property?.type_bien || "N/A"} de ${property?.surface || "?"}m² (${property?.nb_pieces || "?"} pièces)

💰 **Loyer :**
- Loyer nu : ${leaseData.loyer || 0}€
- Charges : ${leaseData.charges_forfaitaires || 0}€
- **Total mensuel : ${loyerTotal}€**
- Dépôt de garantie : ${leaseData.depot_garantie || 0}€

📅 **Durée :**
- Début : ${leaseData.date_debut || "N/A"}
- Fin : ${leaseData.date_fin || "Reconduction tacite"}
- Type : ${leaseData.type_bail || "N/A"}

💡 *Rappel : Tu peux demander ta quittance pour tout loyer payé.*`
    };
  },
  {
    name: "get_my_lease",
    description: "Récupère les informations de mon bail actuel (loyer, charges, dates, adresse). Utilise cet outil quand le locataire veut connaître les détails de son bail ou de son logement.",
    schema: z.object({}),
  }
);

// ============================================
// GET MY PAYMENTS - Mes paiements
// ============================================

export const getMyPaymentsTool = tool(
  async (input: { limit?: number }): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Tenant Tool] Getting my payments");
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) return { success: false, message: "Profil non trouvé" };
    
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select(`
        id,
        periode,
        montant_total,
        montant_loyer,
        montant_charges,
        statut,
        date_echeance,
        date_paiement
      `)
      .eq("tenant_id", profile.id)
      .order("date_echeance", { ascending: false })
      .limit(input.limit || 12);
    
    if (error) {
      console.error("[Tenant Tool] Error getting payments:", error);
      return { success: false, message: "Erreur lors de la récupération des paiements" };
    }
    
    if (!invoices || invoices.length === 0) {
      return { 
        success: true, 
        data: [], 
        message: "💰 Aucun historique de paiement trouvé." 
      };
    }
    
    const paid = invoices.filter(i => i.statut === "paid");
    const pending = invoices.filter(i => i.statut === "sent" || i.statut === "draft");
    const late = invoices.filter(i => i.statut === "late" || i.statut === "very_late");
    
    const totalPaid = paid.reduce((sum, i) => sum + (i.montant_total || 0), 0);
    const totalPending = pending.reduce((sum, i) => sum + (i.montant_total || 0), 0);
    const totalLate = late.reduce((sum, i) => sum + (i.montant_total || 0), 0);
    
    // Formater les derniers paiements
    const recentPayments = invoices.slice(0, 5).map(inv => {
      const statusEmoji = inv.statut === "paid" ? "✅" : inv.statut === "late" ? "🔴" : "🟡";
      return `${statusEmoji} ${inv.periode} : ${inv.montant_total}€ (${inv.statut === "paid" ? "Payé le " + inv.date_paiement : "Échéance " + inv.date_echeance})`;
    }).join("\n");
    
    return {
      success: true,
      data: { invoices, paid: paid.length, pending: pending.length, late: late.length },
      message: `💰 **Résumé de tes paiements**

📊 **Statistiques :**
- ✅ Payés : ${paid.length} factures (${totalPaid.toLocaleString("fr-FR")}€)
- 🟡 En attente : ${pending.length} factures (${totalPending.toLocaleString("fr-FR")}€)
- 🔴 En retard : ${late.length} factures (${totalLate.toLocaleString("fr-FR")}€)

📋 **Dernières factures :**
${recentPayments}

${late.length > 0 ? "\n⚠️ *Tu as des loyers en retard. Contacte ton propriétaire pour un échéancier si nécessaire.*" : ""}
${pending.length > 0 ? "\n💡 *N'oublie pas de régler tes factures en attente avant l'échéance.*" : ""}`
    };
  },
  {
    name: "get_my_payments",
    description: "Récupère l'historique de mes paiements de loyer avec le statut (payé, en attente, en retard). Utilise quand le locataire demande ses paiements ou son historique.",
    schema: z.object({
      limit: z.number().optional().default(12).describe("Nombre de mois à afficher (défaut: 12)"),
    }),
  }
);

// ============================================
// REQUEST RECEIPT - Demander une quittance
// ============================================

export const requestReceiptTool = tool(
  async (input: { periode?: string }): Promise<{ success: boolean; message: string }> => {
    console.log("[Tenant Tool] Requesting receipt:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) return { success: false, message: "Profil non trouvé" };
    
    // Trouver la facture payée (la plus récente ou celle spécifiée)
    let query = supabase
      .from("invoices")
      .select("*, lease:leases(owner_id)")
      .eq("tenant_id", profile.id)
      .eq("statut", "paid")
      .order("periode", { ascending: false });
    
    if (input.periode) {
      query = query.eq("periode", input.periode);
    }
    
    const { data: invoices, error } = await query.limit(1);
    
    if (error || !invoices || invoices.length === 0) {
      return { 
        success: false, 
        message: input.periode 
          ? `Aucune facture payée trouvée pour ${input.periode}. La quittance n'est disponible que pour les loyers payés.`
          : "Aucun loyer payé trouvé. La quittance n'est disponible que pour les loyers payés."
      };
    }
    
    const invoice = invoices[0];
    const lease = invoice.lease as Record<string, unknown> | null;
    
    // Créer une notification pour le propriétaire
    const { error: notifError } = await supabase.from("notifications").insert({
      type: "receipt_request",
      title: "Demande de quittance",
      message: `${profile.prenom} ${profile.nom} demande sa quittance pour la période ${invoice.periode}`,
      profile_id: lease?.owner_id,
      priority: "normal",
      channels: ["in_app", "email"],
      metadata: {
        invoice_id: invoice.id,
        periode: invoice.periode,
        tenant_name: `${profile.prenom} ${profile.nom}`,
      },
    });
    
    if (notifError) {
      console.error("[Tenant Tool] Error creating notification:", notifError);
    }
    
    return {
      success: true,
      message: `✅ **Demande de quittance envoyée !**

📄 Période demandée : ${invoice.periode}
💰 Montant : ${invoice.montant_total}€

Ton propriétaire a été notifié. Tu recevras ta quittance sous **48h maximum**.

💡 *Rappel : La quittance est un document obligatoire que ton propriétaire doit te fournir gratuitement pour tout loyer payé (article 21 loi du 6 juillet 1989).*`
    };
  },
  {
    name: "request_receipt",
    description: "Demande une quittance de loyer au propriétaire. La quittance prouve que le loyer a été payé. Utilise cet outil quand le locataire a besoin d'une quittance (pour un dossier, la CAF, etc.).",
    schema: z.object({
      periode: z.string().optional().describe("Période de la quittance (ex: 2025-01). Si non spécifié, prend le dernier loyer payé."),
    }),
  }
);

// ============================================
// REPORT PROBLEM - Signaler un problème
// ============================================

export const reportProblemTool = tool(
  async (input: { title: string; description: string; urgent?: boolean }): Promise<{ success: boolean; ticketId?: string; message: string }> => {
    console.log("[Tenant Tool] Reporting problem:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, prenom, nom")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) return { success: false, message: "Profil non trouvé" };
    
    // Trouver le bail actif du locataire pour obtenir property_id et owner_id
    const { data: signer, error: signerError } = await supabase
      .from("lease_signers")
      .select(`
        lease:leases (
          id,
          property_id,
          owner_id,
          property:properties (
            adresse_complete
          )
        )
      `)
      .eq("profile_id", profile.id)
      .in("role", ["locataire_principal", "colocataire"])
      .limit(1)
      .single();
    
    if (signerError || !signer?.lease) {
      return { 
        success: false, 
        message: "Aucun bail actif trouvé. Tu dois avoir un bail actif pour signaler un problème." 
      };
    }
    
    const lease = signer.lease as Record<string, unknown>;
    const property = lease.property as Record<string, unknown> | null;
    
    // Créer le ticket
    const { data: ticket, error: ticketError } = await supabase
      .from("tickets")
      .insert({
        titre: input.title,
        description: input.description,
        priorite: input.urgent ? "haute" : "normale",
        property_id: lease.property_id,
        owner_id: lease.owner_id,
        lease_id: lease.id,
        created_by_profile_id: profile.id,
        statut: "open",
      })
      .select("id")
      .single();
    
    if (ticketError) {
      console.error("[Tenant Tool] Error creating ticket:", ticketError);
      return { success: false, message: `Erreur lors de la création du ticket: ${ticketError.message}` };
    }
    
    // Notifier le propriétaire
    await supabase.from("notifications").insert({
      type: "ticket_created",
      title: input.urgent ? "🚨 Ticket urgent créé" : "Nouveau ticket créé",
      message: `${profile.prenom} ${profile.nom} a signalé : ${input.title}`,
      profile_id: lease.owner_id,
      priority: input.urgent ? "high" : "normal",
      channels: input.urgent ? ["in_app", "email", "push"] : ["in_app", "email"],
      action_url: `/app/owner/tickets/${ticket.id}`,
      metadata: {
        ticket_id: ticket.id,
        property_address: property?.adresse_complete,
      },
    });
    
    const ticketRef = ticket.id.substring(0, 8).toUpperCase();
    
    return {
      success: true,
      ticketId: ticket.id,
      message: `🔧 **Ticket créé avec succès !**

📋 **Référence :** #${ticketRef}
📍 **Logement :** ${property?.adresse_complete || "N/A"}
${input.urgent ? "⚠️ **Marqué comme URGENT**" : ""}

**Problème signalé :**
${input.title}

${input.description}

---

✅ Ton propriétaire a été notifié ${input.urgent ? "en urgence " : ""}et reviendra vers toi rapidement.

💡 *Tu peux suivre l'avancement de ton ticket en demandant "mes tickets en cours".*`
    };
  },
  {
    name: "report_problem",
    description: "Signale un problème dans le logement (fuite, panne, dégradation, etc.). Crée un ticket de maintenance que le propriétaire recevra. Utilise pour tout problème technique.",
    schema: z.object({
      title: z.string().describe("Titre court et clair du problème (ex: Fuite robinet cuisine, Panne chauffe-eau)"),
      description: z.string().describe("Description détaillée du problème : où, quand, gravité, photos prises ?"),
      urgent: z.boolean().optional().default(false).describe("Est-ce urgent ? (dégât des eaux actif, panne chauffage en hiver, danger électrique)"),
    }),
  }
);

// ============================================
// GET MY TICKETS - Mes tickets en cours
// ============================================

export const getMyTicketsTool = tool(
  async (input: { includeResolved?: boolean }): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Tenant Tool] Getting my tickets");
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) return { success: false, message: "Profil non trouvé" };
    
    const statuses = input.includeResolved 
      ? ["open", "in_progress", "resolved", "closed"]
      : ["open", "in_progress"];
    
    const { data: tickets, error } = await supabase
      .from("tickets")
      .select(`
        id,
        titre,
        description,
        statut,
        priorite,
        created_at,
        updated_at,
        property:properties (
          adresse_complete
        )
      `)
      .eq("created_by_profile_id", profile.id)
      .in("statut", statuses)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (error) {
      console.error("[Tenant Tool] Error getting tickets:", error);
      return { success: false, message: "Erreur lors de la récupération des tickets" };
    }
    
    if (!tickets || tickets.length === 0) {
      return { 
        success: true, 
        data: [], 
        message: "✅ **Aucun ticket en cours !**\n\nTout semble aller bien. Si tu as un problème à signaler, dis-moi !" 
      };
    }
    
    const statusLabels: Record<string, string> = {
      open: "🔴 Ouvert",
      in_progress: "🟡 En cours",
      resolved: "🟢 Résolu",
      closed: "⚫ Fermé",
    };
    
    const priorityLabels: Record<string, string> = {
      basse: "📉",
      normale: "📊",
      haute: "📈 Prioritaire",
    };
    
    const ticketList = tickets.map(t => {
      const status = statusLabels[t.statut] || t.statut;
      const priority = priorityLabels[t.priorite] || "";
      const ref = t.id.substring(0, 8).toUpperCase();
      const property = t.property as Record<string, unknown> | null;
      const createdDate = new Date(t.created_at).toLocaleDateString("fr-FR");
      
      return `**#${ref}** - ${t.titre}
   ${status} ${priority}
   📍 ${property?.adresse_complete || "N/A"}
   📅 Créé le ${createdDate}`;
    }).join("\n\n");
    
    const openCount = tickets.filter(t => t.statut === "open").length;
    const inProgressCount = tickets.filter(t => t.statut === "in_progress").length;
    
    return {
      success: true,
      data: tickets,
      message: `🔧 **Tes tickets ${input.includeResolved ? "" : "en cours "}(${tickets.length})**

${ticketList}

---

📊 **Résumé :** ${openCount} ouvert(s), ${inProgressCount} en cours de traitement

💡 *Les tickets "en cours" signifient que ton propriétaire a pris en charge le problème.*`
    };
  },
  {
    name: "get_my_tickets",
    description: "Affiche mes tickets de maintenance signalés et leur statut (ouvert, en cours, résolu). Utilise pour suivre l'avancement des réparations.",
    schema: z.object({
      includeResolved: z.boolean().optional().default(false).describe("Inclure les tickets résolus/fermés dans la liste"),
    }),
  }
);

// ============================================
// GET MY DOCUMENTS - Mes documents
// ============================================

export const getMyDocumentsTool = tool(
  async (input: { type?: string }): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Tenant Tool] Getting my documents");
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();
    
    if (!profile) return { success: false, message: "Profil non trouvé" };
    
    let query = supabase
      .from("documents")
      .select(`
        id,
        type,
        nom_fichier,
        created_at,
        verification_status
      `)
      .eq("tenant_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20);
    
    if (input.type) {
      query = query.eq("type", input.type);
    }
    
    const { data: documents, error } = await query;
    
    if (error) {
      console.error("[Tenant Tool] Error getting documents:", error);
      return { success: false, message: "Erreur lors de la récupération des documents" };
    }
    
    if (!documents || documents.length === 0) {
      return { 
        success: true, 
        data: [], 
        message: "📂 Aucun document trouvé. Tes quittances et documents seront disponibles ici une fois générés." 
      };
    }
    
    const typeLabels: Record<string, string> = {
      bail: "📜 Bail",
      quittance: "🧾 Quittance",
      edl_entree: "📋 EDL entrée",
      edl_sortie: "📋 EDL sortie",
      attestation_assurance: "🛡️ Assurance",
      piece_identite: "🪪 Pièce d'identité",
      avis_imposition: "📊 Avis d'imposition",
    };
    
    const docList = documents.map(d => {
      const typeLabel = typeLabels[d.type] || `📄 ${d.type}`;
      const date = new Date(d.created_at).toLocaleDateString("fr-FR");
      return `${typeLabel} - ${d.nom_fichier || "Document"} (${date})`;
    }).join("\n");
    
    // Grouper par type
    const grouped = documents.reduce((acc, d) => {
      acc[d.type] = (acc[d.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const summary = Object.entries(grouped)
      .map(([type, count]) => `- ${typeLabels[type] || type}: ${count}`)
      .join("\n");
    
    return {
      success: true,
      data: documents,
      message: `📂 **Tes documents (${documents.length})**

${summary}

---

📋 **Liste :**
${docList}

💡 *Tu peux demander une quittance pour tout loyer payé.*`
    };
  },
  {
    name: "get_my_documents",
    description: "Liste mes documents disponibles (bail, quittances, EDL, assurance). Utilise pour retrouver un document.",
    schema: z.object({
      type: z.enum(["bail", "quittance", "edl_entree", "edl_sortie", "attestation_assurance"]).optional().describe("Type de document à filtrer"),
    }),
  }
);

// ============================================
// EXPORT ALL TENANT TOOLS
// ============================================

export const tenantTools = [
  getMyLeaseTool,
  getMyPaymentsTool,
  requestReceiptTool,
  reportProblemTool,
  getMyTicketsTool,
  getMyDocumentsTool,
];

export default tenantTools;

