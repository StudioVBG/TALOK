"use client";

/**
 * Sprint 5 — Vue admin read-only des conversations Messages.
 *
 * Affichée comme un onglet dans /admin/moderation. Liste toutes les
 * conversations actives via le RPC get_conversations_enriched (Sprint 3) —
 * accessible à l'admin grâce à la clause `user_role()='admin'` des RLS
 * Sprint 1. Click sur une conversation → ouvre un Sheet avec ChatWindow
 * en mode readOnly.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MessageSquare, RefreshCw, ChevronRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";

import {
  chatService,
  type Conversation,
  type ConversationEnriched,
  type ConversationType,
} from "@/lib/services/chat.service";
import { ChatWindow } from "@/components/chat/chat-window";
import {
  ConversationRoleBadge,
  type ConversationRole,
} from "@/components/chat/conversation-role-badge";

const TYPE_LABELS: Record<ConversationType, string> = {
  owner_tenant: "Propriétaire ↔ Locataire",
  owner_provider: "Propriétaire ↔ Prestataire",
  tenant_provider: "Locataire ↔ Prestataire",
};

interface AdminConversationsPanelProps {
  /**
   * Profil admin courant — utilisé comme `currentProfileId` du ChatWindow.
   * Comme l'admin n'est jamais participant, getOtherPartyInfo retournera
   * role=null, ce qui est OK : le badge "rôle de l'autre" ne s'affiche pas
   * mais les messages restent lisibles via la clause RLS admin.
   */
  adminProfileId: string;
}

export function AdminConversationsPanel({ adminProfileId }: AdminConversationsPanelProps) {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<ConversationEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFull, setSelectedFull] = useState<Conversation | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const result = await chatService.getConversationsEnriched({ limit: 100, offset: 0 });
      setConversations(result.data);
    } catch (error) {
      console.error("[AdminConversationsPanel] load", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (enriched: ConversationEnriched) => {
    try {
      const full = await chatService.getConversation(enriched.id);
      if (full) {
        setSelectedFull(full);
        setSheetOpen(true);
      }
    } catch (error) {
      console.error("[AdminConversationsPanel] open", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ouvrir la conversation",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {conversations.length} conversation{conversations.length > 1 ? "s" : ""} active{conversations.length > 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Actualiser
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {conversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">Aucune conversation active</p>
            </div>
          ) : (
            <div className="divide-y">
              {conversations.map((conv) => (
                <motion.button
                  key={conv.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  type="button"
                  onClick={() => handleSelect(conv)}
                  className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">
                        {TYPE_LABELS[conv.conversation_type]}
                      </Badge>
                      {conv.other_party_role && (
                        <ConversationRoleBadge
                          role={conv.other_party_role as ConversationRole}
                          size="sm"
                          showIcon={false}
                        />
                      )}
                    </div>
                    <p className="text-sm font-medium truncate">
                      {conv.other_party_name || "Conversation"}
                    </p>
                    {conv.other_party_subtitle && (
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.other_party_subtitle}
                      </p>
                    )}
                    {conv.last_message_preview && (
                      <p className="text-xs text-muted-foreground truncate mt-1 italic">
                        "{conv.last_message_preview}"
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {conv.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(conv.last_message_at), "d MMM HH:mm", { locale: fr })}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full sm:max-w-2xl p-0 flex flex-col">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="text-base">Conversation — vue admin</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            {selectedFull && (
              <ChatWindow
                conversation={selectedFull}
                currentProfileId={adminProfileId}
                readOnly
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
