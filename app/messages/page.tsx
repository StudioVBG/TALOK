"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Send,
  MoreVertical,
  ArrowLeft,
} from "lucide-react";
import {
  unifiedChatService,
  type Conversation,
  type Message,
  type ConversationType,
} from "@/lib/services/unified-chat.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";
import { ProtectedRoute } from "@/components/protected-route";

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

function MessagesPage() {
  const { profile, loading: authLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<ConversationType | "all">("all");
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [usePolling, setUsePolling] = useState(false);
  const [isMobileView, setIsMobileView] = useState(false);

  // Détection du mode mobile
  useEffect(() => {
    const checkMobile = () => setIsMobileView(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    try {
      const type = typeFilter === "all" ? undefined : typeFilter;
      const data = await unifiedChatService.getConversations(type);
      setConversations(data);
    } catch (error) {
      console.error("Erreur chargement conversations:", error);
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (conversationId: string) => {
    setMessagesLoading(true);
    try {
      const data = await unifiedChatService.getMessages(conversationId);
      setMessages(data);
      // Marquer comme lu
      await unifiedChatService.markAsRead(conversationId);
      // Mettre à jour le compteur dans la liste
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, my_unread_count: 0 } : c
        )
      );
    } catch (error) {
      console.error("Erreur chargement messages:", error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  // Souscription aux conversations
  useEffect(() => {
    loadConversations();

    let unsubscribe: (() => void) | undefined;
    let pollInterval: NodeJS.Timeout | undefined;

    try {
      unsubscribe = unifiedChatService.subscribeToConversations((updated) => {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === updated.id ? { ...c, ...updated } : c
          )
        );
      });

      if (!unifiedChatService.isRealtimeEnabled()) {
        setUsePolling(true);
      }
    } catch {
      setUsePolling(true);
    }

    if (usePolling) {
      pollInterval = setInterval(loadConversations, 15000);
    }

    return () => {
      unsubscribe?.();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [loadConversations, usePolling]);

  // Souscription aux messages de la conversation sélectionnée
  useEffect(() => {
    if (!selectedConversation) return;

    loadMessages(selectedConversation.id);

    const unsubscribe = unifiedChatService.subscribeToMessages(
      selectedConversation.id,
      (message) => {
        setMessages((prev) => [...prev, message]);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedConversation, loadMessages]);

  // Recharger quand le filtre change
  useEffect(() => {
    setLoading(true);
    loadConversations();
  }, [typeFilter, loadConversations]);

  // Envoyer un message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;

    setSending(true);
    try {
      const message = await unifiedChatService.sendMessage(
        selectedConversation.id,
        newMessage.trim()
      );
      setMessages((prev) => [...prev, message]);
      setNewMessage("");
    } catch (error) {
      console.error("Erreur envoi message:", error);
    } finally {
      setSending(false);
    }
  };

  // Filtrer les conversations
  const filteredConversations = conversations.filter((conv) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      conv.other_participant_name?.toLowerCase().includes(searchLower) ||
      conv.property_address?.toLowerCase().includes(searchLower) ||
      conv.subject?.toLowerCase().includes(searchLower)
    );
  });

  // Formater les dates
  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isToday(date)) return format(date, "HH:mm", { locale: fr });
    if (isYesterday(date)) return `Hier ${format(date, "HH:mm", { locale: fr })}`;
    return format(date, "dd/MM/yyyy HH:mm", { locale: fr });
  };

  const formatConversationDate = (dateString?: string | null) => {
    if (!dateString) return "";
    return formatDistanceToNow(new Date(dateString), {
      addSuffix: true,
      locale: fr,
    });
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

  if (authLoading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-4 p-4">
      {/* Liste des conversations */}
      <AnimatePresence mode="wait">
        {(!isMobileView || !selectedConversation) && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full md:w-96 flex-shrink-0"
          >
            <Card className="h-full flex flex-col">
              <CardHeader className="py-3 space-y-3 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Messages
                    {usePolling && (
                      <Badge variant="outline" className="text-xs">
                        Hors-ligne
                      </Badge>
                    )}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={loadConversations}
                    title="Actualiser"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>

                {/* Recherche */}
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
                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-20 w-full" />
                      ))}
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="text-muted-foreground">
                        {search ? "Aucun résultat" : "Aucune conversation"}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {filteredConversations.map((conversation) => {
                        const unreadCount = conversation.my_unread_count || 0;
                        const isSelected = selectedConversation?.id === conversation.id;

                        return (
                          <motion.div
                            key={conversation.id}
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => setSelectedConversation(conversation)}
                            className={`p-3 rounded-lg cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-primary/10 border border-primary/20"
                                : "hover:bg-muted/50"
                            } ${unreadCount > 0 ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
                          >
                            <div className="flex items-start gap-3">
                              <Avatar className="h-10 w-10 flex-shrink-0">
                                {conversation.other_participant_avatar && (
                                  <AvatarImage src={conversation.other_participant_avatar} />
                                )}
                                <AvatarFallback>
                                  {getInitials(conversation.other_participant_name)}
                                </AvatarFallback>
                              </Avatar>

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <p className={`font-medium truncate ${unreadCount > 0 ? "font-semibold" : ""}`}>
                                    {conversation.other_participant_name || "Utilisateur"}
                                  </p>
                                  {conversation.last_message_at && (
                                    <span className="text-xs text-muted-foreground flex-shrink-0">
                                      {formatConversationDate(conversation.last_message_at)}
                                    </span>
                                  )}
                                </div>

                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 mt-0.5">
                                  {typeIcons[conversation.type]}
                                  <span className="ml-1">{typeLabels[conversation.type]}</span>
                                </Badge>

                                {conversation.last_message_preview && (
                                  <p className={`text-sm mt-1 truncate ${
                                    unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                                  }`}>
                                    {conversation.last_message_preview}
                                  </p>
                                )}
                              </div>

                              {unreadCount > 0 && (
                                <Badge className="h-6 min-w-6 flex items-center justify-center rounded-full">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zone de conversation */}
      <AnimatePresence mode="wait">
        {(!isMobileView || selectedConversation) && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex-1"
          >
            <Card className="h-full flex flex-col">
              {selectedConversation ? (
                <>
                  {/* Header de la conversation */}
                  <CardHeader className="py-3 border-b flex-shrink-0">
                    <div className="flex items-center gap-3">
                      {isMobileView && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedConversation(null)}
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </Button>
                      )}
                      <Avatar className="h-10 w-10">
                        {selectedConversation.other_participant_avatar && (
                          <AvatarImage src={selectedConversation.other_participant_avatar} />
                        )}
                        <AvatarFallback>
                          {getInitials(selectedConversation.other_participant_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {selectedConversation.other_participant_name || "Utilisateur"}
                        </p>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {typeLabels[selectedConversation.type]}
                          </Badge>
                          {selectedConversation.property_address && (
                            <span className="text-xs text-muted-foreground truncate">
                              {selectedConversation.property_address}
                            </span>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={loadConversations}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Actualiser
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    {messagesLoading ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="h-16 w-3/4" />
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="h-full flex items-center justify-center">
                        <p className="text-muted-foreground">
                          Aucun message. Commencez la conversation !
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message, index) => {
                          const isMe = message.sender_profile_id === profile?.id;
                          const showAvatar =
                            index === 0 ||
                            messages[index - 1].sender_profile_id !== message.sender_profile_id;

                          return (
                            <motion.div
                              key={message.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`flex gap-2 max-w-[80%] ${
                                  isMe ? "flex-row-reverse" : ""
                                }`}
                              >
                                {showAvatar && !isMe && (
                                  <Avatar className="h-8 w-8 flex-shrink-0">
                                    {message.sender_avatar && (
                                      <AvatarImage src={message.sender_avatar} />
                                    )}
                                    <AvatarFallback className="text-xs">
                                      {getInitials(message.sender_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                {!showAvatar && !isMe && <div className="w-8" />}

                                <div>
                                  {showAvatar && !isMe && (
                                    <p className="text-xs text-muted-foreground mb-1">
                                      {message.sender_name}
                                    </p>
                                  )}
                                  <div
                                    className={`px-4 py-2 rounded-2xl ${
                                      isMe
                                        ? "bg-primary text-primary-foreground rounded-tr-md"
                                        : "bg-muted rounded-tl-md"
                                    }`}
                                  >
                                    <p className="text-sm whitespace-pre-wrap">
                                      {message.content}
                                    </p>
                                  </div>
                                  <p className={`text-xs text-muted-foreground mt-1 ${isMe ? "text-right" : ""}`}>
                                    {formatMessageDate(message.created_at)}
                                  </p>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </ScrollArea>

                  {/* Zone de saisie */}
                  <div className="p-4 border-t flex-shrink-0">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage();
                      }}
                      className="flex gap-2"
                    >
                      <Textarea
                        placeholder="Écrivez votre message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        className="min-h-[44px] max-h-32 resize-none"
                        rows={1}
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={!newMessage.trim() || sending}
                      >
                        <Send className="h-5 w-5" />
                      </Button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">
                      Sélectionnez une conversation
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Choisissez une conversation dans la liste pour commencer
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function MessagesPageWrapper() {
  return (
    <ProtectedRoute allowedRoles={["owner", "tenant", "provider", "admin"]}>
      <MessagesPage />
    </ProtectedRoute>
  );
}

