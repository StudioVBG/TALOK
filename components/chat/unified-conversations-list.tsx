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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MessageSquare,
  Home,
  Users,
  Wrench,
  Building2,
  Filter,
  RefreshCw,
} from "lucide-react";
import {
  unifiedChatService,
  type Conversation,
  type ConversationType,
} from "@/lib/services/unified-chat.service";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface UnifiedConversationsListProps {
  currentProfileId: string;
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  filterType?: ConversationType;
}

// Icônes par type de conversation
const typeIcons: Record<ConversationType, React.ReactNode> = {
  owner_tenant: <Home className="h-4 w-4" />,
  owner_provider: <Wrench className="h-4 w-4" />,
  owner_syndic: <Building2 className="h-4 w-4" />,
  tenant_provider: <Wrench className="h-4 w-4" />,
  roommates: <Users className="h-4 w-4" />,
  syndic_owners: <Building2 className="h-4 w-4" />,
  group: <Users className="h-4 w-4" />,
  ticket: <MessageSquare className="h-4 w-4" />,
  announcement: <MessageSquare className="h-4 w-4" />,
};

// Labels par type
const typeLabels: Record<ConversationType, string> = {
  owner_tenant: "Propriétaire / Locataire",
  owner_provider: "Propriétaire / Prestataire",
  owner_syndic: "Propriétaire / Syndic",
  tenant_provider: "Locataire / Prestataire",
  roommates: "Colocataires",
  syndic_owners: "Syndic / Propriétaires",
  group: "Groupe",
  ticket: "Ticket",
  announcement: "Annonce",
};

// Couleurs par rôle
const roleColors: Record<string, string> = {
  owner: "bg-emerald-100 text-emerald-800",
  tenant: "bg-blue-100 text-blue-800",
  roommate: "bg-indigo-100 text-indigo-800",
  provider: "bg-amber-100 text-amber-800",
  syndic: "bg-purple-100 text-purple-800",
  admin: "bg-red-100 text-red-800",
  guarantor: "bg-gray-100 text-gray-800",
};

export function UnifiedConversationsList({
  currentProfileId,
  selectedId,
  onSelect,
  filterType,
}: UnifiedConversationsListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ConversationType | "all">(
    filterType || "all"
  );
  const [usePolling, setUsePolling] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const type = typeFilter === "all" ? undefined : typeFilter;
      const data = await unifiedChatService.getConversations(type);
      setConversations(data);
    } catch (error) {
      console.error("Erreur chargement conversations:", error);
      // Silently degrade - conversations list just stays empty
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    loadConversations();

    let unsubscribe: (() => void) | undefined;
    let pollInterval: NodeJS.Timeout | undefined;

    // Tenter la souscription Realtime
    try {
      unsubscribe = unifiedChatService.subscribeToConversations((updated) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === updated.id ? { ...c, ...updated } : c
          )
        );
      });

      // Vérifier si Realtime fonctionne
      if (!unifiedChatService.isRealtimeEnabled()) {
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

  // Recharger quand le filtre change
  useEffect(() => {
    setLoading(true);
    loadConversations();
  }, [typeFilter, loadConversations]);

  const filteredConversations = conversations.filter((conv) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      conv.other_participant_name?.toLowerCase().includes(searchLower) ||
      conv.property_address?.toLowerCase().includes(searchLower) ||
      conv.subject?.toLowerCase().includes(searchLower) ||
      conv.last_message_preview?.toLowerCase().includes(searchLower)
    );
  });

  const formatLastMessage = (dateString?: string | null) => {
    if (!dateString) return "";
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: fr,
      });
    } catch {
      return "";
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="py-3">
          <Skeleton className="h-10 w-full" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="py-3 flex-shrink-0 space-y-3">
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

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filtre par type */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Filter className="h-4 w-4 mr-2" />
              {typeFilter === "all" ? "Tous les types" : typeLabels[typeFilter]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem onClick={() => setTypeFilter("all")}>
              Tous les types
            </DropdownMenuItem>
            {Object.entries(typeLabels).map(([key, label]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setTypeFilter(key as ConversationType)}
              >
                <span className="mr-2">{typeIcons[key as ConversationType]}</span>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <ScrollArea className="flex-1">
        <CardContent className="p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground">
                {search
                  ? "Aucun résultat"
                  : "Aucune conversation"}
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                {!search && "Commencez une nouvelle conversation"}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredConversations.map((conversation) => {
                const unreadCount = conversation.my_unread_count || 0;
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
                      {/* Avatar */}
                      <Avatar className="h-12 w-12 flex-shrink-0">
                        {conversation.other_participant_avatar && (
                          <AvatarImage src={conversation.other_participant_avatar} />
                        )}
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10">
                          {getInitials(conversation.other_participant_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        {/* Nom et date */}
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`font-medium truncate ${
                              unreadCount > 0 ? "font-semibold" : ""
                            }`}
                          >
                            {conversation.other_participant_name || "Utilisateur"}
                          </p>
                          {conversation.last_message_at && (
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatLastMessage(conversation.last_message_at)}
                            </span>
                          )}
                        </div>

                        {/* Type et adresse */}
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-5"
                          >
                            {typeIcons[conversation.type]}
                            <span className="ml-1">
                              {typeLabels[conversation.type]}
                            </span>
                          </Badge>
                        </div>

                        {conversation.property_address && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Home className="h-3 w-3" />
                            <span className="truncate">
                              {conversation.property_address}
                            </span>
                          </p>
                        )}

                        {/* Aperçu du dernier message */}
                        {conversation.last_message_preview && (
                          <p
                            className={`text-sm mt-1 truncate ${
                              unreadCount > 0
                                ? "text-foreground font-medium"
                                : "text-muted-foreground"
                            }`}
                          >
                            {conversation.last_message_preview}
                          </p>
                        )}
                      </div>

                      {/* Badge non lu */}
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

export { roleColors, typeLabels, typeIcons };

