"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Search,
  MessageSquare,
  Home,
  RefreshCw,
  Ticket,
  Loader2
} from "lucide-react";
import {
  chatService,
  type ConversationEnriched,
} from "@/lib/services/chat.service";
import { ConversationRoleBadge, type ConversationRole } from "@/components/chat/conversation-role-badge";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ConversationsListProps {
  currentProfileId: string;
  currentRole?: "owner" | "tenant" | "provider" | "admin";
  selectedId?: string;
  onSelect: (conversation: ConversationEnriched) => void;
}

function initialsFromFullName(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return (parts[0][0] ?? "?").toUpperCase();
  return ((parts[0][0] ?? "") + (parts[parts.length - 1][0] ?? "")).toUpperCase();
}

export function ConversationsList({ currentProfileId, currentRole, selectedId, onSelect }: ConversationsListProps) {
  const [conversations, setConversations] = useState<ConversationEnriched[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [usePolling, setUsePolling] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadConversations = useCallback(async (searchTerm?: string) => {
    try {
      setLoadError(null);
      const result = await chatService.getConversationsEnriched({
        search: searchTerm || undefined,
      });
      setConversations(result.data);
    } catch (error) {
      // Log le détail (code Supabase, hint, details) pour faciliter le debug.
      // L'UI reste volontairement générique — on ne fuite pas d'info technique.
      console.error(
        "Erreur chargement conversations:",
        extractErrorMessage(error),
        error
      );
      setLoadError("Impossible de charger les conversations");
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  // Debounce search term — 300ms après la dernière frappe
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(handle);
  }, [search]);

  // Refetch serveur à chaque changement de debouncedSearch (inclus au mount via "")
  useEffect(() => {
    if (debouncedSearch !== "") setSearching(true);
    loadConversations(debouncedSearch);
  }, [debouncedSearch, loadConversations]);

  // Realtime + polling fallback (le load initial est fait par le useEffect debounce ci-dessus).
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let pollInterval: NodeJS.Timeout | undefined;

    try {
      unsubscribe = chatService.subscribeToConversations((updated) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === updated.id
              ? ({ ...c, ...updated } as ConversationEnriched)
              : c
          )
        );
      });

      if (!chatService.isRealtimeEnabled()) {
        setUsePolling(true);
      }
    } catch (error) {
      console.warn("WebSocket non disponible, activation du polling:", error);
      setUsePolling(true);
    }

    // Fallback polling : refetch avec le dernier searchTerm debounce.
    // Si une erreur de chargement est active, on met le polling en pause —
    // inutile de marteler un endpoint qui vient de renvoyer 4xx/5xx. L'utilisateur
    // peut toujours relancer manuellement via le bouton "Réessayer".
    if (usePolling && !loadError) {
      pollInterval = setInterval(() => {
        loadConversations(debouncedSearch);
      }, 15000);
    }

    return () => {
      unsubscribe?.();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loadConversations, usePolling, debouncedSearch, loadError]);


  // Sprint 9 — le filtre est désormais server-side via p_search.
  // Le state `conversations` contient déjà la liste filtrée.
  const filteredConversations = conversations;

  const getUnreadCount = (conv: ConversationEnriched) => {
    if (currentProfileId === conv.owner_profile_id) return conv.owner_unread_count;
    if (currentProfileId === conv.tenant_profile_id) return conv.tenant_unread_count;
    if (currentProfileId === conv.provider_profile_id) return conv.provider_unread_count;
    return 0;
  };

  const formatLastMessage = (dateString?: string | null) => {
    if (!dateString) return "";
    return formatDistanceToNow(new Date(dateString), { 
      addSuffix: true, 
      locale: fr 
    });
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-3">
          <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Messages
            {usePolling && (
              <Badge variant="outline" className="ml-2 text-xs">
                Mode hors-ligne
              </Badge>
            )}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadConversations()}
            title="Actualiser"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
          )}
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-2">
          {loadError && (
            <div className="p-3 mb-2 text-sm text-destructive bg-destructive/10 rounded-lg">
              {loadError}
              <button onClick={() => loadConversations(debouncedSearch)} className="underline ml-1 font-medium">
                Réessayer
              </button>
            </div>
          )}
          {filteredConversations.length === 0 && !loadError ? (
            <div className="text-center py-12 px-4">
              <div className="bg-muted/50 rounded-full p-4 inline-block mb-4">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">
                {search ? "Aucun résultat" : "Aucune conversation"}
              </h4>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                {search
                  ? "Essayez un autre terme de recherche."
                  : currentRole === "owner"
                    ? "Créez une conversation avec un locataire via le bouton ci-dessus."
                    : "Votre propriétaire n'a pas encore envoyé de message. Utilisez le bouton ci-dessus pour initier la conversation."}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conversation) => {
                const unreadCount = getUnreadCount(conversation);
                const isSelected = selectedId === conversation.id;

                return (
                  <motion.div
                    key={conversation.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => onSelect(conversation)}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50"
                    } ${unreadCount > 0 ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        {conversation.other_party_avatar_url && (
                          <AvatarImage
                            src={conversation.other_party_avatar_url}
                            alt={conversation.other_party_name || "Interlocuteur"}
                          />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                          {initialsFromFullName(conversation.other_party_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className={`font-medium truncate ${unreadCount > 0 ? "font-semibold" : ""}`}>
                              {conversation.other_party_name || "Utilisateur"}
                            </p>
                            {conversation.other_party_role && (
                              <ConversationRoleBadge
                                role={conversation.other_party_role as ConversationRole}
                                size="sm"
                                showIcon={false}
                              />
                            )}
                            {conversation.ticket_id && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex-shrink-0">
                                <Ticket className="h-3 w-3 mr-0.5" />
                                Ticket
                              </Badge>
                            )}
                          </div>
                          {conversation.last_message_at && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatLastMessage(conversation.last_message_at)}
                            </span>
                          )}
                        </div>

                        {conversation.other_party_subtitle && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Home className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{conversation.other_party_subtitle}</span>
                          </p>
                        )}

                        {conversation.last_message_preview && (
                          <p className={`text-sm mt-1 truncate ${
                            unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                          }`}>
                            {conversation.last_message_preview}
                          </p>
                        )}
                      </div>

                      {unreadCount > 0 && (
                        <Badge className="h-6 min-w-6 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
}

