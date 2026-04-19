"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Send,
  Paperclip,
  File,
  MoreVertical,
  MoreHorizontal,
  Check,
  CheckCheck,
  ArrowLeft,
  Loader2,
  MessageSquare,
  Pencil,
  Trash2,
  Flag,
  X
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { chatService, type Message, type Conversation } from "@/lib/services/chat.service";
import { getInitials } from "@/lib/design-system/utils";
import { cleanAttachmentName, truncateMiddle } from "@/lib/utils/clean-filename";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

/** Image avec fallback en cas d'erreur de chargement */
function MessageImage({ src, alt, fileName, isMe }: {
  src: string;
  alt: string;
  fileName?: string | null;
  isMe: boolean;
}) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    const cleaned = fileName ? truncateMiddle(cleanAttachmentName(fileName)) : "Image non disponible";
    return (
      <div className={`flex items-center gap-2 text-sm ${
        isMe ? "text-primary-foreground/80" : "text-muted-foreground"
      }`}>
        <Paperclip className="h-4 w-4 flex-shrink-0" />
        <span title={fileName ?? undefined}>{cleaned}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className="max-w-[280px] max-h-[280px] rounded-lg object-cover cursor-pointer"
      onError={() => setHasError(true)}
      loading="lazy"
    />
  );
}

interface ChatWindowProps {
  conversation: Conversation;
  currentProfileId: string;
  onBack?: () => void;
  onConversationStatusChange?: (conversationId: string, status: "archived" | "closed") => void;
}

export function ChatWindow({ conversation, currentProfileId, onBack, onConversationStatusChange }: ChatWindowProps) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState<string>("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = currentProfileId === conversation.owner_profile_id;
  const otherName = isOwner ? conversation.tenant_name : conversation.owner_name;
  const otherAvatar = isOwner ? conversation.tenant_avatar : conversation.owner_avatar;
  const otherPrenom = isOwner ? conversation.tenant_prenom : conversation.owner_prenom;
  const otherNom = isOwner ? conversation.tenant_nom : conversation.owner_nom;

  // Charger les messages
  useEffect(() => {
    loadMessages();
    
    // Marquer comme lus
    chatService.markAsRead(conversation.id);

    // Souscrire aux nouveaux messages + updates
    const unsubscribe = chatService.subscribeToMessages(
      conversation.id,
      (message) => {
        setMessages((prev) => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, message];
        });
        if (message.sender_profile_id !== currentProfileId) {
          chatService.markAsRead(conversation.id);
        }
        setTimeout(scrollToBottom, 100);
      },
      (updatedMessage) => {
        setMessages((prev) =>
          updatedMessage.deleted_at
            ? prev.filter((m) => m.id !== updatedMessage.id)
            : prev.map((m) => (m.id === updatedMessage.id ? updatedMessage : m))
        );
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";

    // Limit to 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "La taille maximale est de 10 Mo",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const attachment = await chatService.uploadAttachment(conversation.id, file);
      const contentType = file.type.startsWith("image/") ? "image" : "file";

      await chatService.sendMessage({
        conversation_id: conversation.id,
        content: file.name,
        content_type: contentType,
        attachment_url: attachment.url,
        attachment_name: attachment.name,
        attachment_type: attachment.type,
        attachment_size: attachment.size,
      });

      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Erreur upload:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le fichier",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleArchive = async () => {
    try {
      await chatService.archiveConversation(conversation.id);
      toast({ title: "Conversation archivée" });
      onConversationStatusChange?.(conversation.id, "archived");
    } catch (error) {
      console.error("Erreur archivage:", error);
      toast({ title: "Erreur", description: "Impossible d'archiver", variant: "destructive" });
    }
  };

  const handleClose = async () => {
    try {
      await chatService.closeConversation(conversation.id);
      toast({ title: "Conversation clôturée", description: "Le sujet a été marqué comme résolu." });
      onConversationStatusChange?.(conversation.id, "closed");
    } catch (error) {
      console.error("Erreur clôture:", error);
      toast({ title: "Erreur", description: "Impossible de clôturer", variant: "destructive" });
    }
  };

  const handleEditStart = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const handleEditSave = async () => {
    if (!editingMessageId || !editContent.trim()) return;
    try {
      const updated = await chatService.editMessage(editingMessageId, editContent.trim());
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      toast({ title: "Message modifié" });
    } catch (error) {
      console.error("Erreur édition:", error);
      toast({ title: "Erreur", description: "Impossible de modifier le message", variant: "destructive" });
    } finally {
      setEditingMessageId(null);
      setEditContent("");
    }
  };

  const handleEditCancel = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const handleDelete = async (messageId: string) => {
    try {
      await chatService.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      toast({ title: "Message supprimé" });
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast({ title: "Erreur", description: "Impossible de supprimer le message", variant: "destructive" });
    }
  };

  const handleReport = async () => {
    if (!reportingMessage || !reportReason) return;
    try {
      await fetch("/api/messages/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: reportingMessage.id,
          conversationId: conversation.id,
          reason: reportReason,
        }),
      });
      toast({ title: "Message signalé", description: "Votre signalement a été envoyé." });
    } catch (error) {
      console.error("Erreur signalement:", error);
      toast({ title: "Erreur", description: "Impossible de signaler le message", variant: "destructive" });
    } finally {
      setReportingMessage(null);
      setReportReason("");
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
            {otherAvatar && <AvatarImage src={otherAvatar} alt={otherName || "Interlocuteur"} />}
            <AvatarFallback>
              {getInitials(otherPrenom, otherNom)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{otherName || "Utilisateur"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {conversation.property_address}
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            {isOwner ? "Locataire" : "Propriétaire"}
          </Badge>
          {conversation.ticket_id && (
            <Badge variant="secondary" className="text-xs">
              Ticket lié
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleClose}>
                Clôturer (résolu)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleArchive} className="text-muted-foreground">
                Archiver
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
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

                        <div className="group relative flex items-center gap-1">
                          {/* Message action menu (appears on hover) */}
                          {isMe && !message.id.startsWith("temp-") && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <MoreHorizontal className="h-3 w-3" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" side="top">
                                {message.content_type === "text" && (
                                  <DropdownMenuItem onClick={() => handleEditStart(message)}>
                                    <Pencil className="h-3 w-3 mr-2" />
                                    Modifier
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDelete(message.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-3 w-3 mr-2" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}

                          <div
                            className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                              isMe
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            }`}
                          >
                            {editingMessageId === message.id ? (
                              <div className="flex flex-col gap-2">
                                <Input
                                  value={editContent}
                                  onChange={(e) => setEditContent(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleEditSave();
                                    if (e.key === "Escape") handleEditCancel();
                                  }}
                                  className="text-sm bg-background text-foreground"
                                  autoFocus
                                />
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" variant="ghost" onClick={handleEditCancel} className="h-6 px-2 text-xs">
                                    <X className="h-3 w-3 mr-1" />Annuler
                                  </Button>
                                  <Button size="sm" onClick={handleEditSave} className="h-6 px-2 text-xs">
                                    <Check className="h-3 w-3 mr-1" />Valider
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {message.content_type === "text" && !message.attachment_url && (
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {message.content}
                                  </p>
                                )}

                                {message.attachment_url && (
                                  <div className={message.content_type !== "text" ? "mt-0" : "mt-2"}>
                                    {message.content_type === "image" || message.attachment_type?.startsWith("image/") ? (
                                      <MessageImage
                                        src={message.attachment_url}
                                        alt={message.attachment_name || "Image"}
                                        fileName={message.attachment_name}
                                        isMe={isMe}
                                      />
                                    ) : (
                                      <a
                                        href={message.attachment_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={message.attachment_name ?? undefined}
                                        className={`flex items-center gap-2 text-sm ${
                                          isMe ? "text-primary-foreground/80" : "text-muted-foreground"
                                        } hover:underline`}
                                      >
                                        <File className="h-4 w-4 flex-shrink-0" />
                                        <span className="truncate">
                                          {message.attachment_name
                                            ? truncateMiddle(cleanAttachmentName(message.attachment_name))
                                            : "Fichier"}
                                        </span>
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
                                  {message.edited_at && (
                                    <span
                                      className={`text-[10px] italic ${
                                        isMe ? "text-primary-foreground/50" : "text-muted-foreground/70"
                                      }`}
                                    >
                                      (modifié)
                                    </span>
                                  )}
                                  {isMe && (
                                    message.read_at ? (
                                      <CheckCheck className="h-3 w-3 text-primary-foreground/60" />
                                    ) : (
                                      <Check className="h-3 w-3 text-primary-foreground/60" />
                                    )
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          {/* Report button for received messages */}
                          {!isMe && !message.id.startsWith("temp-") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
                              onClick={() => { setReportingMessage(message); setReportReason(""); }}
                              title="Signaler ce message"
                            >
                              <Flag className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t flex-shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            onChange={handleFileSelect}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-muted-foreground hover:text-foreground"
            disabled={sending || uploading}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Ajouter une pièce jointe"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <Paperclip className="h-5 w-5" aria-hidden="true" />
            )}
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

      {/* Report dialog */}
      {reportingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setReportingMessage(null)}>
          <div className="bg-background rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Signaler ce message</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
              &quot;{reportingMessage.content}&quot;
            </p>
            <div className="space-y-2 mb-4">
              {[
                { value: "spam", label: "Spam" },
                { value: "harassment", label: "Harcèlement" },
                { value: "inappropriate", label: "Contenu inapproprié" },
                { value: "other", label: "Autre" },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    reportReason === option.value ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="report-reason"
                    value={option.value}
                    checked={reportReason === option.value}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="sr-only"
                  />
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                    reportReason === option.value ? "border-primary" : "border-muted-foreground"
                  }`}>
                    {reportReason === option.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                  </div>
                  <span className="text-sm">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setReportingMessage(null)}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleReport} disabled={!reportReason} variant="destructive">
                <Flag className="h-3 w-3 mr-1" />
                Signaler
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

