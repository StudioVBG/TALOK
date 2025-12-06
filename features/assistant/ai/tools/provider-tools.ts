/**
 * Tools spécifiques pour les Prestataires
 * SOTA Décembre 2025 - GPT-4o + LangGraph
 * 
 * Ces tools permettent aux prestataires de :
 * - Consulter leurs interventions
 * - Mettre à jour les statuts
 * - Voir les détails des biens
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================
// GET MY WORK ORDERS - Mes interventions
// ============================================

export const getMyWorkOrdersTool = tool(
  async (input: { status?: string }): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Provider Tool] Getting my work orders:", input);
    
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
    
    const statuses = input.status 
      ? [input.status] 
      : ["assigned", "scheduled"];
    
    const { data: workOrders, error } = await supabase
      .from("work_orders")
      .select(`
        id,
        statut,
        date_intervention_prevue,
        date_intervention_reelle,
        cout_estime,
        cout_final,
        notes,
        created_at,
        ticket:tickets (
          id,
          titre,
          description,
          priorite,
          property:properties (
            adresse_complete,
            ville,
            code_postal,
            type_bien,
            etage,
            code_acces,
            digicode
          ),
          creator:profiles!tickets_created_by_profile_id_fkey (
            prenom,
            nom,
            telephone
          )
        )
      `)
      .eq("provider_id", profile.id)
      .in("statut", statuses)
      .order("date_intervention_prevue", { ascending: true, nullsFirst: false });
    
    if (error) {
      console.error("[Provider Tool] Error getting work orders:", error);
      return { success: false, message: "Erreur lors de la récupération des interventions" };
    }
    
    if (!workOrders || workOrders.length === 0) {
      const statusLabel = input.status === "done" ? "terminées" : "en attente";
      return { 
        success: true, 
        data: [], 
        message: `📋 Aucune intervention ${statusLabel} pour le moment.` 
      };
    }
    
    const statusLabels: Record<string, string> = {
      assigned: "🔴 À planifier",
      scheduled: "🟡 Planifiée",
      done: "🟢 Terminée",
      cancelled: "⚫ Annulée",
    };
    
    const priorityLabels: Record<string, string> = {
      basse: "",
      normale: "",
      haute: "⚠️ URGENT",
    };
    
    const list = workOrders.map(wo => {
      const ticket = wo.ticket as Record<string, unknown> | null;
      const property = ticket?.property as Record<string, unknown> | null;
      const creator = ticket?.creator as Record<string, unknown> | null;
      
      const status = statusLabels[wo.statut] || wo.statut;
      const priority = priorityLabels[(ticket?.priorite as string) || "normale"];
      const ref = wo.id.substring(0, 8).toUpperCase();
      
      let details = `**#${ref}** ${priority}
📍 ${property?.adresse_complete || "Adresse N/A"}
   ${property?.code_postal || ""} ${property?.ville || ""}
   ${property?.type_bien || ""} ${property?.etage ? `- Étage ${property.etage}` : ""}`;
      
      if (property?.code_acces || property?.digicode) {
        details += `\n   🔑 Code: ${property?.digicode || property?.code_acces}`;
      }
      
      details += `\n\n🔧 **Problème:** ${ticket?.titre || "N/A"}
   ${ticket?.description || ""}`;
      
      if (creator?.telephone) {
        details += `\n\n👤 **Contact:** ${creator?.prenom || ""} ${creator?.nom || ""} - ${creator?.telephone}`;
      }
      
      details += `\n\n${status}`;
      
      if (wo.date_intervention_prevue) {
        const date = new Date(wo.date_intervention_prevue).toLocaleDateString("fr-FR", {
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit"
        });
        details += ` - 📅 ${date}`;
      }
      
      if (wo.cout_estime) {
        details += `\n💰 Budget estimé: ${wo.cout_estime}€`;
      }
      
      return details;
    }).join("\n\n---\n\n");
    
    const assignedCount = workOrders.filter(wo => wo.statut === "assigned").length;
    const scheduledCount = workOrders.filter(wo => wo.statut === "scheduled").length;
    
    return {
      success: true,
      data: workOrders,
      message: `🔧 **Tes interventions (${workOrders.length})**

📊 **Résumé:** ${assignedCount} à planifier, ${scheduledCount} planifiée(s)

---

${list}

---

💡 *Pour mettre à jour le statut d'une intervention, indique-moi la référence et le nouveau statut.*`
    };
  },
  {
    name: "get_my_work_orders",
    description: "Affiche mes interventions assignées avec les détails (adresse, contact, problème). Utilise pour voir les jobs à faire.",
    schema: z.object({
      status: z.enum(["assigned", "scheduled", "done", "cancelled"]).optional().describe("Filtrer par statut (défaut: assigned + scheduled)"),
    }),
  }
);

// ============================================
// UPDATE WORK ORDER STATUS - Mettre à jour statut
// ============================================

export const updateWorkOrderStatusTool = tool(
  async (input: { workOrderId: string; status: string; scheduledDate?: string; finalCost?: number; notes?: string }): Promise<{ success: boolean; message: string }> => {
    console.log("[Provider Tool] Updating work order status:", input);
    
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
    
    // Vérifier que le work order appartient au prestataire
    const { data: workOrder, error: woError } = await supabase
      .from("work_orders")
      .select(`
        id, 
        provider_id, 
        statut,
        ticket:tickets (
          id,
          owner_id,
          titre
        )
      `)
      .eq("id", input.workOrderId)
      .single();
    
    if (woError || !workOrder) {
      return { success: false, message: "Intervention non trouvée. Vérifie la référence." };
    }
    
    if (workOrder.provider_id !== profile.id) {
      return { success: false, message: "Cette intervention ne t'est pas assignée." };
    }
    
    // Préparer la mise à jour
    const updateData: Record<string, unknown> = { 
      statut: input.status,
      updated_at: new Date().toISOString(),
    };
    
    if (input.status === "scheduled" && input.scheduledDate) {
      updateData.date_intervention_prevue = input.scheduledDate;
    }
    
    if (input.status === "done") {
      updateData.date_intervention_reelle = new Date().toISOString();
      if (input.finalCost) {
        updateData.cout_final = input.finalCost;
      }
    }
    
    if (input.notes) {
      updateData.notes = input.notes;
    }
    
    const { error: updateError } = await supabase
      .from("work_orders")
      .update(updateData)
      .eq("id", input.workOrderId);
    
    if (updateError) {
      console.error("[Provider Tool] Error updating work order:", updateError);
      return { success: false, message: `Erreur: ${updateError.message}` };
    }
    
    // Mettre à jour le ticket associé si terminé
    const ticket = workOrder.ticket as Record<string, unknown> | null;
    if (input.status === "done" && ticket) {
      await supabase
        .from("tickets")
        .update({ statut: "resolved", updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      
      // Notifier le propriétaire
      await supabase.from("notifications").insert({
        type: "work_order_completed",
        title: "Intervention terminée",
        message: `L'intervention "${ticket.titre}" a été réalisée par ${profile.prenom} ${profile.nom}`,
        profile_id: ticket.owner_id,
        priority: "normal",
        channels: ["in_app", "email"],
        metadata: {
          work_order_id: input.workOrderId,
          final_cost: input.finalCost,
        },
      });
    }
    
    const statusMessages: Record<string, string> = {
      scheduled: `📅 **Intervention planifiée !**
      
${input.scheduledDate ? `Date prévue: ${new Date(input.scheduledDate).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}` : ""}

Le propriétaire a été notifié. N'oublie pas de confirmer le RDV avec le locataire 24h avant.`,
      
      done: `✅ **Intervention terminée !**

${input.finalCost ? `💰 Coût final: ${input.finalCost}€` : ""}
${input.notes ? `📝 Notes: ${input.notes}` : ""}

Le propriétaire a été notifié. Le ticket a été marqué comme résolu.

💡 *N'oublie pas d'envoyer ta facture si ce n'est pas déjà fait.*`,
      
      cancelled: `❌ **Intervention annulée.**

${input.notes ? `📝 Raison: ${input.notes}` : ""}

Le propriétaire a été notifié.`,
    };
    
    return {
      success: true,
      message: statusMessages[input.status] || `Statut mis à jour: ${input.status}`
    };
  },
  {
    name: "update_work_order_status",
    description: "Met à jour le statut d'une intervention (planifier, terminer, annuler). Utilise après avoir réalisé ou planifié un job.",
    schema: z.object({
      workOrderId: z.string().describe("ID ou référence de l'intervention"),
      status: z.enum(["scheduled", "done", "cancelled"]).describe("Nouveau statut: scheduled (planifiée), done (terminée), cancelled (annulée)"),
      scheduledDate: z.string().optional().describe("Date/heure prévue si status=scheduled (format ISO ou YYYY-MM-DD HH:mm)"),
      finalCost: z.number().optional().describe("Coût final de l'intervention si status=done"),
      notes: z.string().optional().describe("Notes ou commentaires sur l'intervention"),
    }),
  }
);

// ============================================
// GET INTERVENTION HISTORY - Historique
// ============================================

export const getInterventionHistoryTool = tool(
  async (input: { limit?: number }): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Provider Tool] Getting intervention history");
    
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
    
    const { data: workOrders, error } = await supabase
      .from("work_orders")
      .select(`
        id,
        statut,
        date_intervention_reelle,
        cout_final,
        ticket:tickets (
          titre,
          property:properties (
            adresse_complete,
            ville
          )
        )
      `)
      .eq("provider_id", profile.id)
      .eq("statut", "done")
      .order("date_intervention_reelle", { ascending: false })
      .limit(input.limit || 20);
    
    if (error) {
      console.error("[Provider Tool] Error getting history:", error);
      return { success: false, message: "Erreur lors de la récupération de l'historique" };
    }
    
    if (!workOrders || workOrders.length === 0) {
      return { 
        success: true, 
        data: [], 
        message: "📋 Aucune intervention terminée pour le moment." 
      };
    }
    
    const totalRevenue = workOrders.reduce((sum, wo) => sum + (wo.cout_final || 0), 0);
    
    const list = workOrders.map(wo => {
      const ticket = wo.ticket as Record<string, unknown> | null;
      const property = ticket?.property as Record<string, unknown> | null;
      const date = wo.date_intervention_reelle 
        ? new Date(wo.date_intervention_reelle).toLocaleDateString("fr-FR")
        : "N/A";
      
      return `✅ ${ticket?.titre || "Intervention"} - ${date}
   📍 ${property?.ville || "N/A"}
   💰 ${wo.cout_final ? `${wo.cout_final}€` : "Non facturé"}`;
    }).join("\n\n");
    
    return {
      success: true,
      data: workOrders,
      message: `📊 **Historique de tes interventions**

🔢 **Total:** ${workOrders.length} interventions terminées
💰 **Revenus:** ${totalRevenue.toLocaleString("fr-FR")}€

---

${list}`
    };
  },
  {
    name: "get_intervention_history",
    description: "Affiche l'historique de mes interventions terminées avec les revenus. Utilise pour voir les jobs passés.",
    schema: z.object({
      limit: z.number().optional().default(20).describe("Nombre d'interventions à afficher"),
    }),
  }
);

// ============================================
// EXPORT ALL PROVIDER TOOLS
// ============================================

export const providerTools = [
  getMyWorkOrdersTool,
  updateWorkOrderStatusTool,
  getInterventionHistoryTool,
];

export default providerTools;

