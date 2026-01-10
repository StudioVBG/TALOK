"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  Paperclip,
  Image as ImageIcon,
  File,
  MoreVertical,
  Check,
  CheckCheck,
  ArrowLeft,
  Loader2,
  MessageSquare
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { chatService, type Message, type Conversation } from "@/lib/services/chat.service";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ChatWindowProps {
  conversation: Conversation;
  currentProfileId: string;
  onBack?: () => void;
}

export function ChatWindow({ conversation, currentProfileId, onBack }: ChatWindowProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isOwner = currentProfileId === conversation.owner_profile_id;
  const otherName = isOwner ? conversation.tenant_name : conversation.owner_name;

  // Charger les messages
  useEffect(() => {
    loadMessages();
    
    // Marquer comme lus
    chatService.markAsRead(conversation.id);

    // Souscrire aux nouveaux messages
    const unsubscribe = chatService.subscribeToMessages(
      conversation.id,
      (message) => {
        setMessages((prev) => {
          // Éviter les doublons
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
        
        // Marquer comme lus si ce n'est pas notre message
        if (message.sender_profile_id !== currentProfileId) {
          chatService.markAsRead(conversation.id);
        }
        
        // Scroll vers le bas
        setTimeout(scrollToBottom, 100);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [conversation.id, currentProfileId]);

  const loadMessages = async () => {
    try {
      const data = await chatService.getMessages(conversation.id);
      setMessages(data);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Erreur chargement messages:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    if (!newMessage.trim() || sending) return;

    const messageContent = newMessage.trim();
    setNewMessage("");
    setSending(true);

    // Optimistic update
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversation.id,
      sender_profile_id: currentProfileId,
      sender_role: isOwner ? "owner" : "tenant",
      content: messageContent,
      content_type: "text",
      created_at: new Date().toISOString(),
      sender_name: "Vous",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setTimeout(scrollToBottom, 50);

    try {
      const sentMessage = await chatService.sendMessage({
        conversation_id: conversation.id,
        content: messageContent,
      });

      // Remplacer le message optimiste par le vrai
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticMessage.id ? sentMessage : m))
      );
    } catch (error) {
      // Retirer le message optimiste en cas d'erreur
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setNewMessage(messageContent);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return `Hier ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      return date.toLocaleDateString("fr-FR", { 
        day: "numeric", 
        month: "short",
        hour: "2-digit",
        minute: "2-digit"
      });
    }
  };

  const groupMessagesByDate = (messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    messages.forEach((message) => {
      const messageDate = new Date(message.created_at).toLocaleDateString("fr-FR");
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({ date: messageDate, messages: [] });
      }
      groups[groups.length - 1].messages.push(message);
    });

    return groups;
  };

  return (
    <Card className="flex flex-col h-[600px] max-h-[80vh]">
      {/* Header */}
      <CardHeader className="py-3 px-4 border-b flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onBack}
              aria-label="Retour à la liste des conversations"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          <Avatar className="h-10 w-10">
            <AvatarFallback>
              {otherName?.split(" ").map(n => n[0]).join("").toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{otherName || "Utilisateur"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {conversation.property_address}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {isOwner ? "Propriétaire" : "Locataire"}
          </Badge>
        </div>
      </CardHeader>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : ""}`}>
                <Skeleton className={`h-16 w-64 rounded-2xl`} />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Aucun message</p>
            <p className="text-sm text-muted-foreground">
              Commencez la conversation !
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupMessagesByDate(messages).map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date separator */}
                <div className="flex items-center justify-center my-4">
                  <div className="px-3 py-1 bg-muted rounded-full">
                    <span className="text-xs text-muted-foreground">
                      {group.date === new Date().toLocaleDateString("fr-FR")
                        ? "Aujourd'hui"
                        : group.date}
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <AnimatePresence mode="popLayout">
                  {group.messages.map((message, index) => {
                    const isMe = message.sender_profile_id === currentProfileId;
                    const showAvatar = 
                      !isMe && 
                      (index === 0 || group.messages[index - 1]?.sender_profile_id !== message.sender_profile_id);

                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`flex items-end gap-2 mb-2 ${isMe ? "justify-end" : ""}`}
                      >
                        {!isMe && (
                          <div className="w-8">
                            {showAvatar && (
                              <Avatar className="h-8 w-8">
                                {message.sender_avatar && (
                                  <AvatarImage src={message.sender_avatar} />
                                )}
                                <AvatarFallback className="text-xs">
                                  {message.sender_name?.split(" ").map(n => n[0]).join("") || "?"}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                            isMe
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                          }`}
                        >
                          {message.content_type === "text" && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          )}

                          {message.attachment_url && (
                            <div className="mt-2">
                              {message.content_type === "image" ? (
                                <img
                                  src={message.attachment_url}
                                  alt={message.attachment_name || "Image"}
                                  className="max-w-full rounded-lg"
                                />
                              ) : (
                                <a
                                  href={message.attachment_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 text-sm ${
                                    isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                                  } hover:underline`}
                                >
                                  <File className="h-4 w-4" />
                                  {message.attachment_name || "Fichier"}
                                </a>
                              )}
                            </div>
                          )}

                          <div
                            className={`flex items-center gap-1 mt-1 ${
                              isMe ? "justify-end" : ""
                            }`}
                          >
                            <span
                              className={`text-[10px] ${
                                isMe ? "text-primary-foreground/60" : "text-muted-foreground"
                              }`}
                            >
                              {formatMessageTime(message.created_at)}
                            </span>
                            {isMe && (
                              message.read_at ? (
                                <CheckCheck className="h-3 w-3 text-primary-foreground/60" />
                              ) : (
                                <Check className="h-3 w-3 text-primary-foreground/60" />
                              )
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            disabled={sending}
            aria-label="Ajouter une pièce jointe"
          >
            <Paperclip className="h-5 w-5" aria-hidden="true" />
          </Button>

          <Input
            ref={inputRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Écrivez votre message..."
            className="flex-1"
            disabled={sending}
          />

          <Button
            type="submit"
            size="icon"
            className="h-10 w-10"
            disabled={!newMessage.trim() || sending}
            aria-label={sending ? "Envoi en cours..." : "Envoyer le message"}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-5 w-5" aria-hidden="true" />
            )}
          </Button>
        </form>
      </div>
    </Card>
  );
}

