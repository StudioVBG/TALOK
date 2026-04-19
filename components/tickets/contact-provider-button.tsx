"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { createClient } from "@/lib/supabase/client";
import { chatService } from "@/lib/services/chat.service";

interface ContactProviderButtonProps {
  ticketId: string;
  propertyId: string;
  providerProfileId: string;
  providerName: string;
  viewerRole: "owner" | "tenant";
}

/**
 * Bouton "Contacter <prestataire>" affiché sur la fiche ticket.
 * Sprint 4 — initiation provider via ticket. Idempotent : si la conversation
 * existe déjà (UNIQUE partiel Sprint 1), on récupère et on redirige.
 *
 * Le profil courant est résolu côté composant pour ne pas faire fuiter
 * l'identité du caller dans les props (et garder TicketDetailView agnostique
 * du module messages).
 */
export function ContactProviderButton({
  ticketId,
  propertyId,
  providerProfileId,
  providerName,
  viewerRole,
}: ContactProviderButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      if (profileError || !profile) throw new Error("Profil introuvable");

      const conversation =
        viewerRole === "owner"
          ? await chatService.getOrCreateOwnerProviderConversation({
              ticket_id: ticketId,
              property_id: propertyId,
              owner_profile_id: profile.id,
              provider_profile_id: providerProfileId,
            })
          : await chatService.getOrCreateTenantProviderConversation({
              ticket_id: ticketId,
              property_id: propertyId,
              tenant_profile_id: profile.id,
              provider_profile_id: providerProfileId,
            });

      const route = viewerRole === "owner" ? "/owner/messages" : "/tenant/messages";
      router.push(`${route}?conversation=${conversation.id}`);
    } catch (err) {
      console.error("[ContactProviderButton]", err);
      toast({
        title: "Impossible de démarrer la conversation",
        description: err instanceof Error ? err.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={loading}
      className="w-full gap-2"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
      {loading ? "Création…" : `Contacter ${providerName}`}
    </Button>
  );
}
