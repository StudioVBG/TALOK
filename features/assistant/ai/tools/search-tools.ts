/**
 * Tools de Recherche pour l'Assistant IA
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 * 
 * Ces tools permettent à l'assistant de rechercher dans la base de données
 */

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type {
  PropertySearchResult,
  TenantSearchResult,
  PaymentSearchResult,
  TicketSearchResult,
  DocumentSearchResult,
} from "../types";

// ============================================
// SEARCH PROPERTIES TOOL
// ============================================

export const searchPropertiesTool = tool(
  async (input): Promise<PropertySearchResult[]> => {
    console.log("[Assistant Tool] Searching properties:", input);
    
    // Import dynamique pour éviter les erreurs côté client
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    let query = supabase
      .from("properties")
      .select(`
        id,
        type_bien,
        adresse_complete,
        ville,
        surface,
        loyer_base,
        statut
      `)
      .limit(input.limit || 10);
    
    // Filtres conditionnels
    if (input.city) {
      query = query.ilike("ville", `%${input.city}%`);
    }
    if (input.type) {
      query = query.eq("type_bien", input.type);
    }
    if (input.status) {
      query = query.eq("statut", input.status);
    }
    if (input.minRent) {
      query = query.gte("loyer_base", input.minRent);
    }
    if (input.maxRent) {
      query = query.lte("loyer_base", input.maxRent);
    }
    if (input.ownerId) {
      query = query.eq("owner_id", input.ownerId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[Assistant Tool] Error searching properties:", error);
      return [];
    }
    
    return (data || []).map((p: Record<string, unknown>) => ({
      id: p.id as string,
      title: `${p.type_bien} - ${p.ville}`,
      address: p.adresse_complete as string,
      city: p.ville as string,
      type: p.type_bien as string,
      surface: p.surface as number,
      rent: p.loyer_base as number,
      status: (p.statut as string) === "loue" ? "rented" : "available",
    }));
  },
  {
    name: "search_properties",
    description: "Recherche des biens immobiliers dans la base de données. Utilisez cet outil pour trouver des propriétés par ville, type, loyer, etc.",
    schema: z.object({
      city: z.string().optional().describe("Nom de la ville pour filtrer"),
      type: z.enum(["appartement", "maison", "studio", "colocation", "parking"]).optional().describe("Type de bien"),
      status: z.enum(["disponible", "loue", "travaux"]).optional().describe("Statut du bien"),
      minRent: z.number().optional().describe("Loyer minimum en euros"),
      maxRent: z.number().optional().describe("Loyer maximum en euros"),
      ownerId: z.string().optional().describe("ID du propriétaire pour filtrer ses biens"),
      limit: z.number().optional().default(10).describe("Nombre maximum de résultats"),
    }),
  }
);

// ============================================
// SEARCH TENANTS TOOL
// ============================================

export const searchTenantsTool = tool(
  async (input): Promise<TenantSearchResult[]> => {
    console.log("[Assistant Tool] Searching tenants:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    let query = supabase
      .from("profiles")
      .select(`
        id,
        prenom,
        nom,
        email,
        telephone,
        role
      `)
      .eq("role", "tenant")
      .limit(input.limit || 10);
    
    if (input.name) {
      query = query.or(`prenom.ilike.%${input.name}%,nom.ilike.%${input.name}%`);
    }
    if (input.email) {
      query = query.ilike("email", `%${input.email}%`);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[Assistant Tool] Error searching tenants:", error);
      return [];
    }
    
    return (data || []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: `${t.prenom || ""} ${t.nom || ""}`.trim(),
      email: t.email as string,
      phone: t.telephone as string | undefined,
    }));
  },
  {
    name: "search_tenants",
    description: "Recherche des locataires dans la base de données. Utilisez cet outil pour trouver des locataires par nom ou email.",
    schema: z.object({
      name: z.string().optional().describe("Nom ou prénom du locataire"),
      email: z.string().optional().describe("Email du locataire"),
      propertyId: z.string().optional().describe("ID du bien pour trouver son locataire"),
      limit: z.number().optional().default(10).describe("Nombre maximum de résultats"),
    }),
  }
);

// ============================================
// SEARCH PAYMENTS TOOL
// ============================================

export const searchPaymentsTool = tool(
  async (input): Promise<PaymentSearchResult[]> => {
    console.log("[Assistant Tool] Searching payments:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    let query = supabase
      .from("invoices")
      .select(`
        id,
        montant_total,
        statut,
        date_echeance,
        date_paiement,
        periode,
        lease:leases (
          tenant:profiles!leases_tenant_id_fkey (
            prenom,
            nom
          ),
          property:properties (
            adresse_complete
          )
        )
      `)
      .limit(input.limit || 10)
      .order("date_echeance", { ascending: false });
    
    if (input.status) {
      query = query.eq("statut", input.status);
    }
    if (input.tenantId) {
      query = query.eq("tenant_id", input.tenantId);
    }
    if (input.propertyId) {
      query = query.eq("property_id", input.propertyId);
    }
    if (input.ownerId) {
      query = query.eq("owner_id", input.ownerId);
    }
    if (input.fromDate) {
      query = query.gte("date_echeance", input.fromDate);
    }
    if (input.toDate) {
      query = query.lte("date_echeance", input.toDate);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[Assistant Tool] Error searching payments:", error);
      return [];
    }
    
    return (data || []).map((p: Record<string, unknown>) => {
      const lease = p.lease as Record<string, unknown> | null;
      const tenant = lease?.tenant as Record<string, unknown> | null;
      const property = lease?.property as Record<string, unknown> | null;
      
      return {
        id: p.id as string,
        invoiceId: p.id as string,
        amount: p.montant_total as number,
        status: p.statut as "paid" | "pending" | "late" | "very_late",
        dueDate: p.date_echeance as string,
        paidDate: p.date_paiement as string | undefined,
        tenantName: tenant ? `${tenant.prenom || ""} ${tenant.nom || ""}`.trim() : "Inconnu",
        propertyAddress: (property?.adresse_complete as string) || "Adresse inconnue",
      };
    });
  },
  {
    name: "search_payments",
    description: "Recherche des paiements et factures. Utilisez cet outil pour voir les loyers payés, en retard, ou en attente.",
    schema: z.object({
      status: z.enum(["draft", "sent", "paid", "late"]).optional().describe("Statut du paiement"),
      tenantId: z.string().optional().describe("ID du locataire"),
      propertyId: z.string().optional().describe("ID du bien"),
      ownerId: z.string().optional().describe("ID du propriétaire"),
      fromDate: z.string().optional().describe("Date de début (YYYY-MM-DD)"),
      toDate: z.string().optional().describe("Date de fin (YYYY-MM-DD)"),
      limit: z.number().optional().default(10).describe("Nombre maximum de résultats"),
    }),
  }
);

// ============================================
// SEARCH TICKETS TOOL
// ============================================

export const searchTicketsTool = tool(
  async (input): Promise<TicketSearchResult[]> => {
    console.log("[Assistant Tool] Searching tickets:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    let query = supabase
      .from("tickets")
      .select(`
        id,
        titre,
        description,
        statut,
        priorite,
        created_at,
        property:properties (
          adresse_complete
        ),
        creator:profiles!tickets_created_by_profile_id_fkey (
          prenom,
          nom
        )
      `)
      .limit(input.limit || 10)
      .order("created_at", { ascending: false });
    
    if (input.status) {
      query = query.eq("statut", input.status);
    }
    if (input.priority) {
      query = query.eq("priorite", input.priority);
    }
    if (input.propertyId) {
      query = query.eq("property_id", input.propertyId);
    }
    if (input.ownerId) {
      query = query.eq("owner_id", input.ownerId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[Assistant Tool] Error searching tickets:", error);
      return [];
    }
    
    return (data || []).map((t: Record<string, unknown>) => {
      const property = t.property as Record<string, unknown> | null;
      const creator = t.creator as Record<string, unknown> | null;
      
      return {
        id: t.id as string,
        title: t.titre as string,
        description: t.description as string,
        status: t.statut as "open" | "in_progress" | "resolved" | "closed",
        priority: t.priorite as "low" | "normal" | "high" | "urgent",
        createdAt: t.created_at as string,
        propertyAddress: (property?.adresse_complete as string) || "Adresse inconnue",
        tenantName: creator ? `${creator.prenom || ""} ${creator.nom || ""}`.trim() : undefined,
      };
    });
  },
  {
    name: "search_tickets",
    description: "Recherche des tickets de maintenance. Utilisez cet outil pour voir les demandes d'intervention, leur statut et leur priorité.",
    schema: z.object({
      status: z.enum(["open", "in_progress", "resolved", "closed"]).optional().describe("Statut du ticket"),
      priority: z.enum(["basse", "normale", "haute"]).optional().describe("Priorité du ticket"),
      propertyId: z.string().optional().describe("ID du bien"),
      ownerId: z.string().optional().describe("ID du propriétaire"),
      limit: z.number().optional().default(10).describe("Nombre maximum de résultats"),
    }),
  }
);

// ============================================
// SEARCH DOCUMENTS TOOL
// ============================================

export const searchDocumentsTool = tool(
  async (input): Promise<DocumentSearchResult[]> => {
    console.log("[Assistant Tool] Searching documents:", input);
    
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    
    let query = supabase
      .from("documents")
      .select(`
        id,
        type,
        nom_fichier,
        created_at,
        property_id,
        lease_id,
        verification_status
      `)
      .limit(input.limit || 10)
      .order("created_at", { ascending: false });
    
    if (input.type) {
      query = query.eq("type", input.type);
    }
    if (input.propertyId) {
      query = query.eq("property_id", input.propertyId);
    }
    if (input.leaseId) {
      query = query.eq("lease_id", input.leaseId);
    }
    if (input.ownerId) {
      query = query.eq("owner_id", input.ownerId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error("[Assistant Tool] Error searching documents:", error);
      return [];
    }
    
    return (data || []).map((d: Record<string, unknown>) => ({
      id: d.id as string,
      type: d.type as string,
      name: d.nom_fichier as string,
      uploadedAt: d.created_at as string,
      propertyId: d.property_id as string | undefined,
      leaseId: d.lease_id as string | undefined,
      status: d.verification_status as "verified" | "pending" | "rejected" | undefined,
    }));
  },
  {
    name: "search_documents",
    description: "Recherche des documents (baux, quittances, EDL, etc.). Utilisez cet outil pour trouver des documents par type ou par bien.",
    schema: z.object({
      type: z.enum(["bail", "quittance", "edl_entree", "edl_sortie", "attestation_assurance", "piece_identite", "avis_imposition"]).optional().describe("Type de document"),
      propertyId: z.string().optional().describe("ID du bien"),
      leaseId: z.string().optional().describe("ID du bail"),
      ownerId: z.string().optional().describe("ID du propriétaire"),
      limit: z.number().optional().default(10).describe("Nombre maximum de résultats"),
    }),
  }
);

// ============================================
// EXPORT ALL SEARCH TOOLS
// ============================================

export const searchTools = [
  searchPropertiesTool,
  searchTenantsTool,
  searchPaymentsTool,
  searchTicketsTool,
  searchDocumentsTool,
];

export default searchTools;

