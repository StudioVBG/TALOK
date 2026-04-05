"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Wrench,
  Clock,
  MapPin,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  Loader2,
  User,
  FileText,
  ImageIcon,
  HardHat,
  Calendar,
} from "lucide-react";

// ── Config statuts FR ──

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof AlertCircle }> = {
  open: { label: "Ouvert", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: AlertCircle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Wrench },
  paused: { label: "En pause", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400", icon: PauseCircle },
  resolved: { label: "Résolu", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  closed: { label: "Clôturé", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", icon: CheckCircle2 },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  basse: { label: "Basse", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" },
  haute: { label: "Haute", color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" },
};

// ── Types ──

interface TicketMessage {
  id: string;
  body: string;
  created_at: string;
  is_internal?: boolean;
  attachments?: string[];
  sender?: { prenom: string; nom: string; avatar_url?: string; role?: string } | null;
}

interface WorkOrder {
  id: string;
  statut: string;
  date_intervention_prevue?: string | null;
  cout_estime?: number | null;
  provider?: { nom: string; prenom: string; telephone?: string } | null;
}

interface TicketDetail {
  id: string;
  titre: string;
  description: string;
  statut: string;
  priorite: string;
  categorie?: string;
  created_at: string;
  property?: { adresse_complete: string; ville?: string; code_postal?: string } | null;
  creator?: { nom: string; prenom: string; email?: string; telephone?: string } | null;
  messages?: TicketMessage[];
  work_orders?: WorkOrder[];
}

// ── Loading skeleton ──

function TicketDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-10 w-3/4" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-60 rounded-2xl" />
        </div>
        <Skeleton className="h-60 rounded-2xl" />
      </div>
    </div>
  );
}

// ── Page principale ──

export default function TenantTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  // ── Fetch ticket details ──
  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}`);
      if (!res.ok) {
        if (res.status === 404) { setError("Ticket non trouvé"); return; }
        if (res.status === 403) { setError("Accès non autorisé"); return; }
        throw new Error("Erreur serveur");
      }
      const data = await res.json();
      setTicket(data.ticket || data);
    } catch {
      setError("Impossible de charger le ticket");
    }
  }, [ticketId]);

  // ── Fetch messages ──
  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`);
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
    } catch {
      // Non-blocking
    }
  }, [ticketId]);

  // ── Initial load ──
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTicket(), fetchMessages()]).finally(() => setLoading(false));
  }, [fetchTicket, fetchMessages]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!ticketId) return;

    const channel = supabase
      .channel(`ticket-messages-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          // Skip internal messages (should be filtered by RLS, but double-check)
          if (newMsg.is_internal) return;
          // Fetch full message with sender info
          await fetchMessages();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [ticketId, supabase, fetchMessages]);

  // ── Scroll to bottom on new messages ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Send message ──
  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newMessage.trim() }),
      });
      if (!res.ok) throw new Error("Erreur");
      setNewMessage("");
      await fetchMessages();
    } catch {
      toast({ title: "Erreur", description: "Impossible d'envoyer le message.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  // ── Render states ──

  if (loading) return <TicketDetailSkeleton />;

  if (error || !ticket) {
    return (
      <PageTransition>
        <div className="container mx-auto px-4 py-24 max-w-4xl text-center">
          <div className="p-4 bg-red-100 dark:bg-red-900/30 rounded-full w-fit mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">{error || "Ticket introuvable"}</h2>
          <p className="text-muted-foreground mb-4">Le ticket demandé n'existe pas ou vous n'y avez pas accès.</p>
          <Button variant="outline" asChild>
            <Link href="/tenant/requests"><ArrowLeft className="h-4 w-4 mr-2" /> Retour aux demandes</Link>
          </Button>
        </div>
      </PageTransition>
    );
  }

  const statusCfg = STATUS_CONFIG[ticket.statut] || STATUS_CONFIG.open;
  const StatusIcon = statusCfg.icon;
  const priorityCfg = PRIORITY_CONFIG[ticket.priorite] || PRIORITY_CONFIG.normale;
  const activeWorkOrder = ticket.work_orders?.find((wo) => wo.statut !== "cancelled");
  const isResolved = ticket.statut === "resolved" || ticket.statut === "closed";

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">

        {/* ── Header ── */}
        <div>
          <Link
            href="/tenant/requests"
            className="group text-sm font-bold text-muted-foreground hover:text-indigo-600 flex items-center gap-2 transition-colors mb-4"
          >
            <div className="p-1.5 rounded-lg bg-muted group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </div>
            Retour aux demandes
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl font-black tracking-tight text-foreground">{ticket.titre}</h1>
            <div className="flex items-center gap-2">
              <Badge className={cn("gap-1.5 font-bold", statusCfg.color)}>
                <StatusIcon className="h-3.5 w-3.5" />
                {statusCfg.label}
              </Badge>
              <Badge className={cn("font-bold", priorityCfg.color)}>
                {priorityCfg.label}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Colonne principale (messages) ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Description */}
            <GlassCard className="p-6 border-border bg-card">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Description</h3>
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">{ticket.description}</p>
            </GlassCard>

            {/* Messages */}
            <GlassCard className="p-0 border-border bg-card overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
                <h3 className="font-bold text-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Messages ({messages.length})
                </h3>
              </div>

              <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    Aucun message pour l'instant. Envoyez le premier message ci-dessous.
                  </p>
                ) : (
                  messages.map((msg) => {
                    const senderName = msg.sender
                      ? `${msg.sender.prenom || ""} ${msg.sender.nom || ""}`.trim()
                      : "Système";
                    const isOwnerOrProvider = msg.sender?.role === "owner" || msg.sender?.role === "provider";
                    const initials = senderName
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "?";

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex gap-3",
                          isOwnerOrProvider ? "flex-row" : "flex-row-reverse"
                        )}
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className={cn(
                            "text-xs font-bold",
                            isOwnerOrProvider
                              ? "bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}>
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className={cn(
                          "max-w-[75%] rounded-2xl p-3",
                          isOwnerOrProvider
                            ? "bg-muted rounded-tl-sm"
                            : "bg-indigo-600 text-white rounded-tr-sm"
                        )}>
                          <p className={cn(
                            "text-xs font-bold mb-1",
                            isOwnerOrProvider ? "text-muted-foreground" : "text-white/70"
                          )}>
                            {senderName}
                            {msg.sender?.role === "owner" && " (Propriétaire)"}
                            {msg.sender?.role === "provider" && " (Prestataire)"}
                          </p>
                          <p className={cn(
                            "text-sm whitespace-pre-wrap",
                            isOwnerOrProvider ? "text-foreground" : "text-white"
                          )}>
                            {msg.body}
                          </p>
                          <p className={cn(
                            "text-[10px] mt-1",
                            isOwnerOrProvider ? "text-muted-foreground/60" : "text-white/50"
                          )}>
                            {(() => {
                              const d = new Date(msg.created_at);
                              return isNaN(d.getTime()) ? "" : formatDistanceToNow(d, { addSuffix: true, locale: fr });
                            })()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Formulaire réponse */}
              {!isResolved ? (
                <div className="p-4 border-t border-border bg-muted/30">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Écrire un message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      className="min-h-[44px] max-h-[120px] resize-none bg-background"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      size="icon"
                      className="h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sending}
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-t border-border bg-emerald-50 dark:bg-emerald-950/20 text-center">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium flex items-center justify-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Ce ticket est {ticket.statut === "resolved" ? "résolu" : "clôturé"}.
                  </p>
                </div>
              )}
            </GlassCard>
          </div>

          {/* ── Sidebar infos ── */}
          <div className="space-y-4">

            {/* Infos ticket */}
            <GlassCard className="p-5 border-border bg-card space-y-4">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Informations</h3>

              {ticket.property && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">Bien concerné</p>
                    <p className="text-sm font-medium text-foreground">{ticket.property.adresse_complete}</p>
                    {ticket.property.ville && (
                      <p className="text-xs text-muted-foreground">{ticket.property.code_postal} {ticket.property.ville}</p>
                    )}
                  </div>
                </div>
              )}

              {ticket.categorie && (
                <div className="flex items-start gap-3">
                  <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-muted-foreground">Catégorie</p>
                    <p className="text-sm font-medium text-foreground capitalize">{ticket.categorie}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">Créé le</p>
                  <p className="text-sm font-medium text-foreground">
                    {(() => {
                      const d = new Date(ticket.created_at);
                      return isNaN(d.getTime()) ? "—" : format(d, "d MMMM yyyy 'à' HH:mm", { locale: fr });
                    })()}
                  </p>
                </div>
              </div>
            </GlassCard>

            {/* Work order (prestataire assigné) */}
            {activeWorkOrder && (
              <GlassCard className="p-5 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
                <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                  <HardHat className="h-4 w-4" />
                  Intervention
                </h3>

                {activeWorkOrder.provider && (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-bold">
                        {(activeWorkOrder.provider.prenom?.[0] || "") + (activeWorkOrder.provider.nom?.[0] || "")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {activeWorkOrder.provider.prenom} {activeWorkOrder.provider.nom}
                      </p>
                      <p className="text-xs text-muted-foreground">Prestataire assigné</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="font-bold capitalize">
                    {activeWorkOrder.statut === "assigned" ? "Assigné" :
                     activeWorkOrder.statut === "scheduled" ? "Planifié" :
                     activeWorkOrder.statut === "in_progress" ? "En cours" :
                     activeWorkOrder.statut === "done" ? "Terminé" :
                     activeWorkOrder.statut}
                  </Badge>
                  {activeWorkOrder.date_intervention_prevue && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {(() => {
                        const d = new Date(activeWorkOrder.date_intervention_prevue);
                        return isNaN(d.getTime()) ? "—" : format(d, "d MMM yyyy", { locale: fr });
                      })()}
                    </span>
                  )}
                </div>

                {activeWorkOrder.cout_estime && (
                  <p className="text-xs text-muted-foreground">
                    Estimation : {activeWorkOrder.cout_estime.toLocaleString("fr-FR")} €
                  </p>
                )}
              </GlassCard>
            )}

            {/* Actions */}
            <GlassCard className="p-5 border-border bg-card space-y-3">
              <Button variant="outline" className="w-full rounded-xl font-bold" asChild>
                <Link href="/tenant/requests">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Toutes mes demandes
                </Link>
              </Button>
              <Button variant="outline" className="w-full rounded-xl font-bold" asChild>
                <Link href="/tenant/messages">
                  <MessageSquare className="h-4 w-4 mr-2" /> Contacter mon propriétaire
                </Link>
              </Button>
            </GlassCard>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
