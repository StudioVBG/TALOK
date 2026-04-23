/**
 * Service partagé de création de ticket.
 *
 * Source unique pour la logique métier "créer un ticket" appelée par :
 *   - POST /api/tickets   (route historique, tenant-side)
 *   - POST /api/v1/tickets (API v1, owner-side avec feature gating)
 *
 * Avant l'extraction, les deux routes divergeaient :
 *   - /api/tickets avait le helper resolveTicketContext (invited_email, etc.)
 *   - /api/v1/tickets avait un check lease_signers simpliste qui renvoyait
 *     un 403 dès qu'un locataire était invité par email.
 * Maintenant les deux partagent exactement les mêmes garanties.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTicketContext } from "./resolve-ticket-context";
import { resolveSyndicForProperty } from "./resolve-syndic";
import { suggestForTicketCategory } from "./charges-classification";

export interface CreateTicketInput {
  property_id?: string | null;
  lease_id?: string | null;
  titre: string;
  description: string;
  category?: string | null;
  priorite: string;
  photos?: string[];
}

export interface CreateTicketAuth {
  user_id: string;       // auth.users.id
  user_email: string | null;
  profile_id: string;
  profile_email: string | null;
  profile_role: string;
}

export type CreateTicketResult =
  | {
      ok: true;
      ticket: {
        id: string;
        reference: string | null;
        property_id: string | null;
        lease_id: string | null;
        statut: string;
        is_tenant_chargeable: boolean | null;
        charge_category_code: string | null;
      };
    }
  | {
      ok: false;
      code: string;
      status: number;
      message: string;
    };

/**
 * Crée un ticket et déclenche les side-effects (outbox, audit log, AI).
 * La fonction ne fait jamais throw : toutes les erreurs attendues sont
 * retournées dans un discriminated union.
 */
export async function createTicket(args: {
  serviceClient: SupabaseClient<any>;
  auth: CreateTicketAuth;
  input: CreateTicketInput;
}): Promise<CreateTicketResult> {
  const { serviceClient, auth, input } = args;

  // 1. Résolution contexte (property_id, lease_id, owner) + RBAC
  const userEmail = auth.profile_email ?? auth.user_email ?? null;
  const context = await resolveTicketContext({
    serviceClient,
    profileId: auth.profile_id,
    role: auth.profile_role,
    userEmail,
    propertyId: input.property_id ?? null,
    leaseId: input.lease_id ?? null,
  });

  if (!context.ok) {
    return {
      ok: false,
      code: context.code,
      status: context.status,
      message: context.message,
    };
  }

  // 2. Routage parties communes → syndic
  const isPartiesCommunes = input.category === "parties_communes";
  const syndicRouting = isPartiesCommunes
    ? await resolveSyndicForProperty(serviceClient, context.property_id)
    : { entity_id: null, syndic_profile_id: null, syndic_user_id: null };

  // 3. Classification charges récupérables (décret 87-713)
  const chargeSuggestion = suggestForTicketCategory(input.category ?? null);

  // 4. Insertion ticket
  const { data: ticket, error: insertError } = await serviceClient
    .from("tickets")
    .insert({
      titre: input.titre,
      description: input.description,
      category: input.category ?? null,
      priorite: input.priorite,
      photos: input.photos ?? [],
      property_id: context.property_id,
      lease_id: context.lease_id ?? input.lease_id ?? null,
      created_by_profile_id: auth.profile_id,
      owner_id: context.owner_profile_id,
      entity_id: syndicRouting.entity_id,
      assigned_to: syndicRouting.syndic_profile_id,
      statut: syndicRouting.syndic_profile_id ? "acknowledged" : "open",
      is_tenant_chargeable: chargeSuggestion.is_tenant_chargeable,
      charge_category_code: chargeSuggestion.charge_category_code,
    })
    .select(
      "id, reference, property_id, lease_id, statut, is_tenant_chargeable, charge_category_code"
    )
    .single();

  if (insertError) {
    return {
      ok: false,
      code: "INSERT_FAILED",
      status: 500,
      message: insertError.message || "Erreur lors de la création du ticket",
    };
  }

  const ticketRow = ticket as {
    id: string;
    reference: string | null;
    property_id: string | null;
    lease_id: string | null;
    statut: string;
    is_tenant_chargeable: boolean | null;
    charge_category_code: string | null;
  };

  // 5. Outbox event (parties communes → syndic, sinon → owner)
  const recipientUserId = syndicRouting.syndic_user_id ?? context.owner_user_id;

  await serviceClient.from("outbox").insert({
    event_type:
      isPartiesCommunes && syndicRouting.syndic_profile_id
        ? "Ticket.OpenedPartiesCommunes"
        : "Ticket.Opened",
    payload: {
      ticket_id: ticketRow.id,
      ticket_reference: ticketRow.reference,
      property_id: context.property_id,
      lease_id: context.lease_id,
      entity_id: syndicRouting.entity_id,
      priority: input.priorite,
      title: input.titre,
      category: input.category ?? null,
      owner_id: context.owner_user_id,
      syndic_user_id: syndicRouting.syndic_user_id,
      recipient_user_id: recipientUserId,
      created_by: auth.profile_id,
      creator_role: context.creator_role,
    },
  } as any);

  // 6. Audit log (best-effort, n'échoue pas le flow si l'insert échoue)
  try {
    await serviceClient.from("audit_log").insert({
      user_id: auth.user_id,
      action: "ticket_created",
      entity_type: "ticket",
      entity_id: ticketRow.id,
      metadata: { priority: input.priorite, category: input.category ?? null },
    } as any);
  } catch {
    /* non-blocking */
  }

  return { ok: true, ticket: ticketRow };
}
