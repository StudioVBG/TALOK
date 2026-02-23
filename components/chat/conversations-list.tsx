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
  RefreshCw
} from "lucide-react";
import { chatService, type Conversation } from "@/lib/services/chat.service";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ConversationsListProps {
  currentProfileId: string;
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
}

export function ConversationsList({ currentProfileId, selectedId, onSelect }: ConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [usePolling, setUsePolling] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data);
    } catch (error) {
      console.error("Erreur chargement conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();

    let unsubscribe: (() => void) | undefined;
    let pollInterval: NodeJS.Timeout | undefined;

    // Tenter la souscription Realtime
    try {
      unsubscribe = chatService.subscribeToConversations((updated) => {
        setConversations((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
      });

      // Vérifier si Realtime fonctionne
      if (!chatService.isRealtimeEnabled()) {
        setUsePolling(true);
      }
    } catch (error) {
      console.warn("WebSocket non disponible, activation du polling:", error);
      setUsePolling(true);
    }

    // Fallback: polling toutes les 15 secondes si WebSocket échoue
    if (usePolling) {
      pollInterval = setInterval(() => {
        loadConversations();
      }, 15000);
    }

    return () => {
      unsubscribe?.();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loadConversations, usePolling]);


  const filteredConversations = conversations.filter((conv) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    const isOwner = currentProfileId === conv.owner_profile_id;
    const otherName = isOwner ? conv.tenant_name : conv.owner_name;
    return (
      otherName?.toLowerCase().includes(searchLower) ||
      conv.property_address?.toLowerCase().includes(searchLower) ||
      conv.subject?.toLowerCase().includes(searchLower)
    );
  });

  const getUnreadCount = (conv: Conversation) => {
    const isOwner = currentProfileId === conv.owner_profile_id;
    return isOwner ? conv.owner_unread_count : conv.tenant_unread_count;
  };

  const getOtherName = (conv: Conversation) => {
    const isOwner = currentProfileId === conv.owner_profile_id;
    return isOwner ? conv.tenant_name : conv.owner_name;
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
            className="pl-9"
          />
        </div>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="bg-muted/50 rounded-full p-4 inline-block mb-4">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h4 className="font-semibold text-foreground mb-1">
                {search ? "Aucun résultat" : "Aucune conversation"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {search
                  ? "Essayez un autre terme de recherche."
                  : "Les messages de votre propriétaire apparaîtront ici."}
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
                    } ${unreadCount > 0 ? "bg-blue-50/50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        <AvatarFallback>
                          {getOtherName(conversation)
                            ?.split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`font-medium truncate ${unreadCount > 0 ? "font-semibold" : ""}`}>
                            {getOtherName(conversation) || "Utilisateur"}
                          </p>
                          {conversation.last_message_at && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatLastMessage(conversation.last_message_at)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Home className="h-3 w-3" />
                          <span className="truncate">{conversation.property_address}</span>
                        </p>

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
                          {unreadCount}
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

