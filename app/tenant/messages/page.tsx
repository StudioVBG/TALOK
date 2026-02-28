"use client";

import { MessagesPageContent } from "@/components/messages/MessagesPageContent";
import { useTenantData } from "../_data/TenantDataProvider";

/**
 * AUDIT UX: Page Messages tenant — ajoute la possibilité d'initier
 * une conversation avec le propriétaire via le bail actif.
 */
export default function TenantMessagesPage() {
  const { dashboard } = useTenantData();

  // Préparer les données pour créer une nouvelle conversation
  // uniquement si le locataire a un bail lié avec un propriétaire
  const newConversationData = dashboard?.lease?.property?.id && dashboard?.lease?.owner?.id
    ? {
        property_id: dashboard.lease.property.id,
        owner_profile_id: dashboard.lease.owner.id,
        tenant_profile_id: dashboard.profile_id,
        lease_id: dashboard.lease.id,
        ownerName: dashboard.lease.owner.name || "Mon propriétaire",
      }
    : undefined;

  return (
    <MessagesPageContent
      subtitle="Communiquez avec votre propriétaire et vos intervenants"
      newConversationData={newConversationData}
    />
  );
}
