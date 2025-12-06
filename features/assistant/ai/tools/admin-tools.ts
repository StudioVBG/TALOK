/**
 * Tools spécifiques pour les Administrateurs
 * SOTA Décembre 2025 - GPT-4o + LangGraph
 * 
 * Ces tools permettent aux admins de :
 * - Voir les statistiques globales
 * - Gérer les validations
 * - Surveiller la plateforme
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";

// ============================================
// GET PLATFORM STATS - Statistiques globales
// ============================================

export const getPlatformStatsTool = tool(
  async (): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Admin Tool] Getting platform stats");
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    // Vérifier le rôle admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (!profile || profile.role !== "admin") {
      return { success: false, message: "Accès non autorisé" };
    }
    
    // Compter les entités principales en parallèle
    const [
      { count: ownersCount },
      { count: tenantsCount },
      { count: providersCount },
      { count: propertiesCount },
      { count: activeLeasesCount },
      { count: openTicketsCount },
      { count: lateInvoicesCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "owner"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "tenant"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "provider"),
      supabase.from("properties").select("*", { count: "exact", head: true }),
      supabase.from("leases").select("*", { count: "exact", head: true }).eq("statut", "active"),
      supabase.from("tickets").select("*", { count: "exact", head: true }).eq("statut", "open"),
      supabase.from("invoices").select("*", { count: "exact", head: true }).in("statut", ["late", "very_late"]),
    ]);
    
    // Prestataires en attente
    const { count: pendingProviders } = await supabase
      .from("provider_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    
    // Revenus du mois (factures payées)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const { data: paidInvoices } = await supabase
      .from("invoices")
      .select("montant_total")
      .eq("statut", "paid")
      .gte("date_paiement", startOfMonth.toISOString());
    
    const monthlyRevenue = paidInvoices?.reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
    
    // Inscriptions récentes (7 derniers jours)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { count: newUsersCount } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo.toISOString());
    
    const stats = {
      owners: ownersCount || 0,
      tenants: tenantsCount || 0,
      providers: providersCount || 0,
      properties: propertiesCount || 0,
      activeLeases: activeLeasesCount || 0,
      openTickets: openTicketsCount || 0,
      lateInvoices: lateInvoicesCount || 0,
      pendingProviders: pendingProviders || 0,
      monthlyRevenue,
      newUsers: newUsersCount || 0,
    };
    
    // Calculer le taux de recouvrement
    const { data: allInvoicesMonth } = await supabase
      .from("invoices")
      .select("montant_total, statut")
      .gte("date_echeance", startOfMonth.toISOString());
    
    const totalDue = allInvoicesMonth?.reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
    const totalPaid = allInvoicesMonth?.filter(i => i.statut === "paid").reduce((sum, inv) => sum + (inv.montant_total || 0), 0) || 0;
    const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 100;
    
    return {
      success: true,
      data: stats,
      message: `📊 **Statistiques de la plateforme**

👤 **Utilisateurs:**
- Propriétaires: **${stats.owners}**
- Locataires: **${stats.tenants}**
- Prestataires: **${stats.providers}**
- 📈 Nouveaux (7j): **+${stats.newUsers}**

🏠 **Immobilier:**
- Biens enregistrés: **${stats.properties}**
- Baux actifs: **${stats.activeLeases}**

💰 **Finances (ce mois):**
- Revenus encaissés: **${monthlyRevenue.toLocaleString("fr-FR")}€**
- Taux de recouvrement: **${collectionRate}%**
- 🔴 Factures en retard: **${stats.lateInvoices}**

⚠️ **À traiter:**
- Tickets ouverts: **${stats.openTickets}**
- Prestataires en attente: **${stats.pendingProviders}**

${stats.pendingProviders > 0 ? `\n🔔 *${stats.pendingProviders} prestataire(s) attendent validation.*` : ""}
${stats.lateInvoices > 5 ? `\n⚠️ *Attention: ${stats.lateInvoices} factures en retard à surveiller.*` : ""}`
    };
  },
  {
    name: "get_platform_stats",
    description: "Affiche les statistiques globales de la plateforme (utilisateurs, biens, revenus, alertes). Dashboard admin.",
    schema: z.object({}),
  }
);

// ============================================
// GET PENDING VALIDATIONS - Validations en attente
// ============================================

export const getPendingValidationsTool = tool(
  async (): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Admin Tool] Getting pending validations");
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (!profile || profile.role !== "admin") {
      return { success: false, message: "Accès non autorisé" };
    }
    
    // Récupérer les prestataires en attente avec leurs profils
    const { data: pendingProviders, error } = await supabase
      .from("provider_profiles")
      .select(`
        profile_id,
        type_services,
        certifications,
        zones_intervention,
        created_at
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20);
    
    if (error) {
      console.error("[Admin Tool] Error getting pending validations:", error);
      return { success: false, message: "Erreur lors de la récupération" };
    }
    
    if (!pendingProviders || pendingProviders.length === 0) {
      return { 
        success: true, 
        data: [], 
        message: "✅ **Aucune validation en attente !**\n\nTous les prestataires ont été traités." 
      };
    }
    
    // Récupérer les profils associés
    const profileIds = pendingProviders.map(p => p.profile_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, prenom, nom, email, telephone, created_at")
      .in("id", profileIds);
    
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    
    const list = pendingProviders.map(provider => {
      const prof = profileMap.get(provider.profile_id);
      const services = (provider.type_services as string[])?.join(", ") || "Non spécifié";
      const zones = (provider.zones_intervention as string[])?.slice(0, 3).join(", ") || "Non spécifié";
      const waitingDays = Math.floor((Date.now() - new Date(provider.created_at).getTime()) / (1000 * 60 * 60 * 24));
      
      let urgency = "";
      if (waitingDays > 7) urgency = "🔴 ";
      else if (waitingDays > 3) urgency = "🟡 ";
      
      return `${urgency}**${prof?.prenom || ""} ${prof?.nom || "Inconnu"}**
📧 ${prof?.email || "N/A"}
📞 ${prof?.telephone || "N/A"}
🔧 Services: ${services}
📍 Zones: ${zones}
⏱️ En attente depuis: ${waitingDays} jour(s)
🔗 ID: \`${provider.profile_id}\``;
    }).join("\n\n---\n\n");
    
    const urgentCount = pendingProviders.filter(p => {
      const days = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return days > 7;
    }).length;
    
    return {
      success: true,
      data: pendingProviders,
      message: `⏳ **Prestataires en attente de validation (${pendingProviders.length})**

${urgentCount > 0 ? `🔴 **${urgentCount} attendent depuis plus de 7 jours !**\n\n` : ""}
${list}

---

💡 *Pour valider ou rejeter, utilise l'interface admin ou indique-moi l'action à effectuer.*`
    };
  },
  {
    name: "get_pending_validations",
    description: "Liste les prestataires en attente de validation avec les détails (services, zones, ancienneté).",
    schema: z.object({}),
  }
);

// ============================================
// SEARCH ALL USERS - Rechercher un utilisateur
// ============================================

export const searchAllUsersTool = tool(
  async (input: { query: string; role?: string }): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Admin Tool] Searching users:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (!profile || profile.role !== "admin") {
      return { success: false, message: "Accès non autorisé" };
    }
    
    let query = supabase
      .from("profiles")
      .select(`
        id,
        user_id,
        prenom,
        nom,
        email,
        telephone,
        role,
        created_at
      `)
      .or(`prenom.ilike.%${input.query}%,nom.ilike.%${input.query}%,email.ilike.%${input.query}%`)
      .limit(20);
    
    if (input.role) {
      query = query.eq("role", input.role);
    }
    
    const { data: users, error } = await query;
    
    if (error) {
      console.error("[Admin Tool] Error searching users:", error);
      return { success: false, message: "Erreur lors de la recherche" };
    }
    
    if (!users || users.length === 0) {
      return { 
        success: true, 
        data: [], 
        message: `🔍 Aucun utilisateur trouvé pour "${input.query}"${input.role ? ` (rôle: ${input.role})` : ""}.` 
      };
    }
    
    const roleLabels: Record<string, string> = {
      owner: "🏠 Propriétaire",
      tenant: "🔑 Locataire",
      provider: "🔧 Prestataire",
      admin: "⚙️ Admin",
    };
    
    const list = users.map(u => {
      const role = roleLabels[u.role] || u.role;
      const createdDate = new Date(u.created_at).toLocaleDateString("fr-FR");
      
      return `**${u.prenom || ""} ${u.nom || "Sans nom"}** - ${role}
📧 ${u.email}
📞 ${u.telephone || "N/A"}
📅 Inscrit le ${createdDate}
🔗 ID: \`${u.id}\``;
    }).join("\n\n");
    
    return {
      success: true,
      data: users,
      message: `🔍 **Résultats pour "${input.query}" (${users.length})**

${list}`
    };
  },
  {
    name: "search_all_users",
    description: "Recherche un utilisateur par nom, prénom ou email. Accès admin uniquement.",
    schema: z.object({
      query: z.string().describe("Terme de recherche (nom, prénom ou email)"),
      role: z.enum(["owner", "tenant", "provider", "admin"]).optional().describe("Filtrer par rôle"),
    }),
  }
);

// ============================================
// GET ALERTS - Alertes et anomalies
// ============================================

export const getAlertsTool = tool(
  async (): Promise<{ success: boolean; data?: unknown; message: string }> => {
    console.log("[Admin Tool] Getting alerts");
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: "Non authentifié" };
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    
    if (!profile || profile.role !== "admin") {
      return { success: false, message: "Accès non autorisé" };
    }
    
    const alerts: Array<{ type: string; severity: string; message: string; count?: number }> = [];
    
    // 1. Tickets urgents non assignés depuis 48h
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    
    const { count: urgentTickets } = await supabase
      .from("tickets")
      .select("*", { count: "exact", head: true })
      .eq("statut", "open")
      .eq("priorite", "haute")
      .lt("created_at", twoDaysAgo.toISOString());
    
    if (urgentTickets && urgentTickets > 0) {
      alerts.push({
        type: "tickets",
        severity: "high",
        message: `${urgentTickets} ticket(s) urgent(s) non traité(s) depuis 48h`,
        count: urgentTickets,
      });
    }
    
    // 2. Factures très en retard (> 30 jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { count: veryLateInvoices } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .in("statut", ["late", "very_late"])
      .lt("date_echeance", thirtyDaysAgo.toISOString());
    
    if (veryLateInvoices && veryLateInvoices > 0) {
      alerts.push({
        type: "invoices",
        severity: "high",
        message: `${veryLateInvoices} facture(s) en retard de plus de 30 jours`,
        count: veryLateInvoices,
      });
    }
    
    // 3. Prestataires en attente > 7 jours
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const { count: oldPendingProviders } = await supabase
      .from("provider_profiles")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending")
      .lt("created_at", weekAgo.toISOString());
    
    if (oldPendingProviders && oldPendingProviders > 0) {
      alerts.push({
        type: "providers",
        severity: "medium",
        message: `${oldPendingProviders} prestataire(s) en attente depuis plus de 7 jours`,
        count: oldPendingProviders,
      });
    }
    
    // 4. Baux arrivant à échéance dans 30 jours
    const inThirtyDays = new Date();
    inThirtyDays.setDate(inThirtyDays.getDate() + 30);
    
    const { count: expiringLeases } = await supabase
      .from("leases")
      .select("*", { count: "exact", head: true })
      .eq("statut", "active")
      .lte("date_fin", inThirtyDays.toISOString())
      .gte("date_fin", new Date().toISOString());
    
    if (expiringLeases && expiringLeases > 0) {
      alerts.push({
        type: "leases",
        severity: "low",
        message: `${expiringLeases} bail(aux) arrivent à échéance dans les 30 prochains jours`,
        count: expiringLeases,
      });
    }
    
    if (alerts.length === 0) {
      return {
        success: true,
        data: [],
        message: "✅ **Aucune alerte !**\n\nTout fonctionne normalement sur la plateforme."
      };
    }
    
    const severityEmojis: Record<string, string> = {
      high: "🔴",
      medium: "🟡",
      low: "🟢",
    };
    
    const alertList = alerts
      .sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return (order[a.severity] || 2) - (order[b.severity] || 2);
      })
      .map(a => `${severityEmojis[a.severity]} **${a.message}**`)
      .join("\n");
    
    const highCount = alerts.filter(a => a.severity === "high").length;
    
    return {
      success: true,
      data: alerts,
      message: `🚨 **Alertes de la plateforme (${alerts.length})**

${highCount > 0 ? `⚠️ **${highCount} alerte(s) critique(s) à traiter en priorité !**\n\n` : ""}
${alertList}

---

💡 *Les alertes rouges nécessitent une action immédiate.*`
    };
  },
  {
    name: "get_alerts",
    description: "Affiche les alertes et anomalies de la plateforme (tickets bloqués, impayés, validations en attente).",
    schema: z.object({}),
  }
);

// ============================================
// EXPORT ALL ADMIN TOOLS
// ============================================

export const adminTools = [
  getPlatformStatsTool,
  getPendingValidationsTool,
  searchAllUsersTool,
  getAlertsTool,
];

export default adminTools;

