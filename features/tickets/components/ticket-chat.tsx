"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Message {
  id: string;
  body: string;
  sender_user: string;
  created_at: string;
  sender: {
    prenom: string;
    nom: string;
    avatar_url: string | null;
  };
  is_internal: boolean;
}

interface TicketChatProps {
  ticketId: string;
  currentUserId: string;
}

export function TicketChat({ ticketId, currentUserId }: TicketChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`ticket_messages:${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          // Fetch sender details for the new message
          supabase
            .from("profiles")
            .select("prenom, nom, avatar_url")
            .eq("user_id", newMsg.sender_user)
            .single()
            .then(({ data }) => {
              if (data) {
                setMessages((prev) => [
                  ...prev,
                  { ...newMsg, sender: data },
                ]);
              }
            });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  async function fetchMessages() {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/messages`);
      if (!response.ok) throw new Error("Failed to load messages");
      const data = await response.json();
      setMessages(data.messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage() {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newMessage }),
      });

      if (!response.ok) throw new Error("Failed to send message");
      
      setNewMessage("");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  }

  async function handleGenerateDraft() {
    setGeneratingDraft(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/ai-draft`, {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("AI generation failed");
      
      const data = await response.json();
      if (data.draft) {
        setNewMessage(data.draft);
        toast({
          title: "Brouillon généré",
          description: "L'IA a suggéré une réponse.",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur IA",
        description: "Impossible de générer une réponse.",
        variant: "destructive",
      });
    } finally {
      setGeneratingDraft(false);
    }
  }

  if (loading) return <div className="p-4 text-center">Chargement...</div>;

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="px-4 py-3 border-b">
        <CardTitle className="text-lg flex items-center gap-2">
          Discussion
          <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {messages.length}
          </span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((msg) => {
              const isMe = msg.sender_user === currentUserId;
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={msg.sender?.avatar_url || ""} />
                    <AvatarFallback>
                      {msg.sender?.prenom?.[0]}
                      {msg.sender?.nom?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`max-w-[80%] rounded-lg p-3 text-sm ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <span className="text-[10px] opacity-70 block mt-1">
                      {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="p-4 border-t bg-background">
          <div className="relative">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Écrivez votre message..."
              className="min-h-[100px] pr-12 resize-none"
            />
            <div className="absolute bottom-3 right-3 flex gap-2">
               <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-purple-500 hover:text-purple-600 hover:bg-purple-50"
                onClick={handleGenerateDraft}
                disabled={generatingDraft || sending}
                title="Suggérer une réponse avec l'IA"
              >
                {generatingDraft ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="icon"
                className="h-8 w-8"
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

