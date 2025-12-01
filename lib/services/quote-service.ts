/**
 * Service de gestion des devis pour les prestataires
 * Permet de créer, modifier et suivre les devis d'intervention
 */

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/monitoring";

// Types
export interface QuoteItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Quote {
  id: string;
  providerId: string;
  ticketId: string;
  propertyId: string;
  ownerId: string;
  reference: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  items: QuoteItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  validUntil: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  respondedAt?: string;
}

export interface CreateQuoteInput {
  ticketId: string;
  propertyId: string;
  ownerId: string;
  items: Omit<QuoteItem, "total">[];
  taxRate?: number;
  validDays?: number;
  notes?: string;
}

/**
 * Génère une référence unique pour un devis
 */
function generateQuoteReference(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DEV-${year}${month}-${random}`;
}

/**
 * Crée un nouveau devis
 */
export async function createQuote(
  providerId: string,
  input: CreateQuoteInput
): Promise<{ success: boolean; quote?: Quote; error?: string }> {
  try {
    const supabase = await createClient();

    // Calculer les totaux
    const items: QuoteItem[] = input.items.map((item) => ({
      ...item,
      total: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const taxRate = input.taxRate ?? 20; // TVA 20% par défaut
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Date de validité
    const validDays = input.validDays ?? 30;
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);

    const quote = {
      provider_id: providerId,
      ticket_id: input.ticketId,
      property_id: input.propertyId,
      owner_id: input.ownerId,
      reference: generateQuoteReference(),
      status: "draft",
      items: JSON.stringify(items),
      subtotal,
      tax_rate: taxRate,
      tax_amount: taxAmount,
      total,
      valid_until: validUntil.toISOString(),
      notes: input.notes,
    };

    const { data, error } = await supabase
      .from("quotes")
      .insert(quote)
      .select()
      .single();

    if (error) {
      logger.error("Failed to create quote", { error });
      return { success: false, error: "Erreur lors de la création du devis" };
    }

    logger.info("Quote created", { quoteId: data.id, reference: data.reference });

    return {
      success: true,
      quote: {
        id: data.id,
        providerId: data.provider_id,
        ticketId: data.ticket_id,
        propertyId: data.property_id,
        ownerId: data.owner_id,
        reference: data.reference,
        status: data.status,
        items: JSON.parse(data.items),
        subtotal: data.subtotal,
        taxRate: data.tax_rate,
        taxAmount: data.tax_amount,
        total: data.total,
        validUntil: data.valid_until,
        notes: data.notes,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        sentAt: data.sent_at,
        respondedAt: data.responded_at,
      },
    };
  } catch (error) {
    logger.error("Quote creation failed", { error });
    return { success: false, error: "Une erreur est survenue" };
  }
}

/**
 * Envoie un devis au propriétaire
 */
export async function sendQuote(
  quoteId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("quotes")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
      })
      .eq("id", quoteId)
      .eq("status", "draft");

    if (error) {
      return { success: false, error: "Impossible d'envoyer le devis" };
    }

    // TODO: Envoyer une notification au propriétaire
    logger.info("Quote sent", { quoteId });

    return { success: true };
  } catch (error) {
    logger.error("Failed to send quote", { error });
    return { success: false, error: "Une erreur est survenue" };
  }
}

/**
 * Accepte ou refuse un devis (côté propriétaire)
 */
export async function respondToQuote(
  quoteId: string,
  response: "accepted" | "rejected",
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const { error } = await supabase
      .from("quotes")
      .update({
        status: response,
        responded_at: new Date().toISOString(),
        rejection_reason: response === "rejected" ? reason : null,
      })
      .eq("id", quoteId)
      .eq("status", "sent");

    if (error) {
      return { success: false, error: "Impossible de répondre au devis" };
    }

    // TODO: Envoyer une notification au prestataire
    logger.info("Quote response", { quoteId, response });

    return { success: true };
  } catch (error) {
    logger.error("Failed to respond to quote", { error });
    return { success: false, error: "Une erreur est survenue" };
  }
}

/**
 * Récupère les devis d'un prestataire
 */
export async function getProviderQuotes(
  providerId: string,
  status?: Quote["status"]
): Promise<Quote[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("quotes")
      .select("*")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((q) => ({
      id: q.id,
      providerId: q.provider_id,
      ticketId: q.ticket_id,
      propertyId: q.property_id,
      ownerId: q.owner_id,
      reference: q.reference,
      status: q.status,
      items: JSON.parse(q.items),
      subtotal: q.subtotal,
      taxRate: q.tax_rate,
      taxAmount: q.tax_amount,
      total: q.total,
      validUntil: q.valid_until,
      notes: q.notes,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
      sentAt: q.sent_at,
      respondedAt: q.responded_at,
    }));
  } catch (error) {
    logger.error("Failed to get provider quotes", { error });
    return [];
  }
}

/**
 * Récupère les devis pour un propriétaire
 */
export async function getOwnerQuotes(
  ownerId: string,
  status?: Quote["status"]
): Promise<Quote[]> {
  try {
    const supabase = await createClient();

    let query = supabase
      .from("quotes")
      .select("*")
      .eq("owner_id", ownerId)
      .neq("status", "draft") // Le propriétaire ne voit pas les brouillons
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((q) => ({
      id: q.id,
      providerId: q.provider_id,
      ticketId: q.ticket_id,
      propertyId: q.property_id,
      ownerId: q.owner_id,
      reference: q.reference,
      status: q.status,
      items: JSON.parse(q.items),
      subtotal: q.subtotal,
      taxRate: q.tax_rate,
      taxAmount: q.tax_amount,
      total: q.total,
      validUntil: q.valid_until,
      notes: q.notes,
      createdAt: q.created_at,
      updatedAt: q.updated_at,
      sentAt: q.sent_at,
      respondedAt: q.responded_at,
    }));
  } catch (error) {
    logger.error("Failed to get owner quotes", { error });
    return [];
  }
}

export default {
  createQuote,
  sendQuote,
  respondToQuote,
  getProviderQuotes,
  getOwnerQuotes,
};

