/**
 * Service de contexte utilisateur pour RAG
 * SOTA 2026 - Recherche personnalisée
 * 
 * Vectorise et recherche dans les données de l'utilisateur
 * (biens, baux, locataires, tickets, etc.)
 */

import { createClient } from "@/lib/supabase/server";
import { generateEmbedding, generateEmbeddings } from "./embeddings.service";
import type { UserContextDoc, EntityType } from "./types";

// ============================================
// USER CONTEXT SERVICE
// ============================================

export class UserContextService {
  /**
   * Recherche dans le contexte utilisateur
   */
  async searchUserContext(
    query: string,
    profileId: string,
    options?: {
      entityType?: EntityType;
      limit?: number;
      minSimilarity?: number;
    }
  ): Promise<UserContextDoc[]> {
    const supabase = await createClient();

    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc("match_user_context", {
      query_embedding: queryEmbedding,
      p_profile_id: profileId,
      match_count: options?.limit || 5,
      filter_entity_type: options?.entityType || null,
    });

    if (error) {
      console.error("[UserContext] Search error:", error);
      return [];
    }

    // Filtrer par similarité minimum si spécifié
    const minSim = options?.minSimilarity || 0.6;
    
    return ((data as any[]) || [])
      .filter((doc: any) => doc.similarity >= minSim)
      .map((doc: any) => ({
        id: doc.id,
        entityType: doc.entity_type as EntityType,
        entityId: doc.entity_id,
        content: doc.content,
        summary: doc.summary,
        similarity: doc.similarity,
      }));
  }

  /**
   * Indexe un bien immobilier pour la recherche
   */
  async indexProperty(propertyId: string, profileId: string): Promise<boolean> {
    const supabase = await createClient();

    // Récupérer les données du bien
    const { data: property, error: fetchError } = await supabase
      .from("properties")
      .select(`
        *,
        leases:leases(
          id, 
          type_bail, 
          loyer, 
          date_debut, 
          date_fin, 
          statut,
          tenant:profiles!leases_tenant_id_fkey(prenom, nom)
        )
      `)
      .eq("id", propertyId)
      .single();

    if (fetchError || !property) {
      console.error("[UserContext] Property fetch error:", fetchError);
      return false;
    }

    // Construire le contenu textuel
    const content = this.buildPropertyContent(property);
    const summary = this.buildPropertySummary(property);

    // Générer l'embedding
    const embedding = await generateEmbedding(content);

    // Upsert dans la table
    const { error: upsertError } = await supabase
      .from("user_context_embeddings")
      .upsert(
        {
          profile_id: profileId,
          entity_type: "property",
          entity_id: propertyId,
          content,
          summary,
          embedding,
        } as any,
        { onConflict: "entity_type,entity_id" }
      );

    if (upsertError) {
      console.error("[UserContext] Property index error:", upsertError);
      return false;
    }

    return true;
  }

  /**
   * Indexe un bail pour la recherche
   */
  async indexLease(leaseId: string, profileId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data: lease, error: fetchError } = await supabase
      .from("leases")
      .select(`
        *,
        property:properties(adresse_complete, ville, type),
        tenant:profiles!leases_tenant_id_fkey(prenom, nom, email)
      `)
      .eq("id", leaseId)
      .single();

    if (fetchError || !lease) {
      console.error("[UserContext] Lease fetch error:", fetchError);
      return false;
    }

    const content = this.buildLeaseContent(lease);
    const summary = this.buildLeaseSummary(lease);
    const embedding = await generateEmbedding(content);

    const { error: upsertError } = await supabase
      .from("user_context_embeddings")
      .upsert(
        {
          profile_id: profileId,
          entity_type: "lease",
          entity_id: leaseId,
          content,
          summary,
          embedding,
        } as any,
        { onConflict: "entity_type,entity_id" }
      );

    if (upsertError) {
      console.error("[UserContext] Lease index error:", upsertError);
      return false;
    }

    return true;
  }

  /**
   * Indexe un ticket pour la recherche
   */
  async indexTicket(ticketId: string, profileId: string): Promise<boolean> {
    const supabase = await createClient();

    const { data: ticket, error: fetchError } = await supabase
      .from("tickets")
      .select(`
        *,
        property:properties(adresse_complete, ville),
        creator:profiles!tickets_created_by_profile_id_fkey(prenom, nom)
      `)
      .eq("id", ticketId)
      .single();

    if (fetchError || !ticket) {
      console.error("[UserContext] Ticket fetch error:", fetchError);
      return false;
    }

    const content = this.buildTicketContent(ticket);
    const summary = `Ticket: ${ticket.titre} - ${ticket.statut}`;
    const embedding = await generateEmbedding(content);

    const { error: upsertError } = await supabase
      .from("user_context_embeddings")
      .upsert(
        {
          profile_id: profileId,
          entity_type: "ticket",
          entity_id: ticketId,
          content,
          summary,
          embedding,
        } as any,
        { onConflict: "entity_type,entity_id" }
      );

    if (upsertError) {
      console.error("[UserContext] Ticket index error:", upsertError);
      return false;
    }

    return true;
  }

  /**
   * Indexe toutes les entités d'un utilisateur
   */
  async indexAllUserData(
    profileId: string,
    ownerId?: string
  ): Promise<{ properties: number; leases: number; tickets: number }> {
    const supabase = await createClient();
    const stats = { properties: 0, leases: 0, tickets: 0 };

    // Récupérer les biens
    let propertiesQuery = supabase.from("properties").select("id");
    if (ownerId) {
      propertiesQuery = propertiesQuery.eq("owner_id", ownerId);
    }

    const { data: properties } = await propertiesQuery;
    for (const prop of properties || []) {
      const success = await this.indexProperty(prop.id, profileId);
      if (success) stats.properties++;
    }

    // Récupérer les baux
    let leasesQuery = supabase.from("leases").select("id");
    if (ownerId) {
      leasesQuery = leasesQuery.eq("owner_id", ownerId);
    }

    const { data: leases } = await leasesQuery;
    for (const lease of leases || []) {
      const success = await this.indexLease(lease.id, profileId);
      if (success) stats.leases++;
    }

    // Récupérer les tickets
    let ticketsQuery = supabase.from("tickets").select("id");
    if (ownerId) {
      ticketsQuery = ticketsQuery.eq("owner_id", ownerId);
    }

    const { data: tickets } = await ticketsQuery;
    for (const ticket of tickets || []) {
      const success = await this.indexTicket(ticket.id, profileId);
      if (success) stats.tickets++;
    }

    return stats;
  }

  /**
   * Supprime une entité de l'index
   */
  async removeFromIndex(
    entityType: EntityType,
    entityId: string
  ): Promise<boolean> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("user_context_embeddings")
      .delete()
      .eq("entity_type", entityType)
      .eq("entity_id", entityId);

    return !error;
  }

  /**
   * Formate les résultats pour injection dans le prompt
   */
  formatForPrompt(docs: UserContextDoc[]): string {
    if (docs.length === 0) return "";

    let context = "📋 **Contexte de votre dossier :**\n\n";

    // Grouper par type
    const grouped = docs.reduce((acc, doc) => {
      if (!acc[doc.entityType]) acc[doc.entityType] = [];
      acc[doc.entityType].push(doc);
      return acc;
    }, {} as Record<string, UserContextDoc[]>);

    const typeLabels: Record<string, string> = {
      property: "🏠 Biens",
      lease: "📄 Baux",
      tenant: "👤 Locataires",
      ticket: "🔧 Tickets",
      invoice: "💰 Factures",
      document: "📎 Documents",
    };

    for (const [type, typeDocs] of Object.entries(grouped)) {
      context += `**${typeLabels[type] || type}:**\n`;
      typeDocs.forEach((doc) => {
        const summary = doc.summary || doc.content.substring(0, 150);
        context += `- ${summary}\n`;
      });
      context += "\n";
    }

    return context;
  }

  // ============================================
  // HELPERS PRIVÉS
  // ============================================

  private buildPropertyContent(property: any): string {
    const parts = [
      `Bien immobilier: ${property.type || "Non spécifié"}`,
      `Adresse: ${property.adresse_complete || "Non renseignée"}`,
      `Ville: ${property.ville || "Non renseignée"}`,
      `Surface: ${property.surface ? `${property.surface} m²` : "Non renseignée"}`,
      `Loyer: ${property.loyer_base ? `${property.loyer_base}€` : "Non renseigné"}`,
      `Statut: ${property.statut || "Non défini"}`,
    ];

    if (property.leases && property.leases.length > 0) {
      const activeLease = property.leases.find(
        (l: any) => l.statut === "active"
      );
      if (activeLease) {
        const tenantName = activeLease.tenant
          ? `${activeLease.tenant.prenom} ${activeLease.tenant.nom}`
          : "Non renseigné";
        parts.push(`Locataire actuel: ${tenantName}`);
        parts.push(`Type de bail: ${activeLease.type_bail}`);
      }
    }

    return parts.join(". ");
  }

  private buildPropertySummary(property: any): string {
    return `${property.type || "Bien"} à ${property.ville || "?"} - ${property.loyer_base || "?"}€`;
  }

  private buildLeaseContent(lease: any): string {
    const parts = [
      `Bail ${lease.type_bail || "standard"}`,
      `Loyer: ${lease.loyer || 0}€`,
      `Début: ${lease.date_debut || "Non défini"}`,
      lease.date_fin ? `Fin: ${lease.date_fin}` : "Durée indéterminée",
      `Statut: ${lease.statut || "Non défini"}`,
    ];

    if (lease.property) {
      parts.push(`Bien: ${lease.property.adresse_complete}`);
    }

    if (lease.tenant) {
      parts.push(
        `Locataire: ${lease.tenant.prenom} ${lease.tenant.nom} (${lease.tenant.email})`
      );
    }

    return parts.join(". ");
  }

  private buildLeaseSummary(lease: any): string {
    const tenantName = lease.tenant
      ? `${lease.tenant.prenom} ${lease.tenant.nom}`
      : "?";
    return `Bail ${lease.type_bail} - ${tenantName} - ${lease.loyer}€`;
  }

  private buildTicketContent(ticket: any): string {
    const parts = [
      `Ticket de maintenance: ${ticket.titre}`,
      `Description: ${ticket.description || "Pas de description"}`,
      `Priorité: ${ticket.priorite || "normale"}`,
      `Statut: ${ticket.statut || "ouvert"}`,
      `Créé le: ${ticket.created_at}`,
    ];

    if (ticket.property) {
      parts.push(`Bien: ${ticket.property.adresse_complete}`);
    }

    if (ticket.creator) {
      parts.push(`Créé par: ${ticket.creator.prenom} ${ticket.creator.nom}`);
    }

    return parts.join(". ");
  }
}

// Singleton
export const userContextService = new UserContextService();

export default userContextService;

