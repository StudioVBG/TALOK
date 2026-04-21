"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { GlassCard } from "@/components/ui/glass-card";
import {
  ArrowLeft,
  MapPin,
  Clock,
  Wrench,
  UserCheck,
  Hammer,
  Calendar,
  Camera,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { TicketStatusBadge } from "./ticket-status-badge";
import { PriorityBadge } from "./priority-badge";
import { TicketTimeline } from "./ticket-timeline";
import { TicketChargesClassification } from "./ticket-charges-classification";
import { TicketComments } from "./ticket-comments";
import { AssignProviderModal } from "./assign-provider-modal";
import { CreateWorkOrderButton } from "./create-work-order-button";
import { SatisfactionRating } from "./satisfaction-rating";
import { ContactProviderButton } from "@/components/tickets/contact-provider-button";

const CATEGORY_LABELS: Record<string, string> = {
  plomberie: "Plomberie",
  electricite: "Électricité",
  serrurerie: "Serrurerie",
  chauffage: "Chauffage",
  humidite: "Humidité",
  nuisibles: "Nuisibles",
  bruit: "Bruit",
  parties_communes: "Parties communes",
  equipement: "Équipement",
  autre: "Autre",
};

interface TicketDetailViewProps {
  ticketId: string;
  userRole: "owner" | "tenant" | "provider";
  backHref: string;
}

export function TicketDetailView({ ticketId, userRole, backHref }: TicketDetailViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tickets/${ticketId}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      setTicket(data.ticket);
    } catch {
      toast({ title: "Erreur", description: "Ticket introuvable", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [ticketId, toast]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleStatusAction = async (action: string) => {
    setActionLoading(action);
    try {
      const body: Record<string, unknown> = {};

      if (action === "close" && ticket?.satisfaction_rating) {
        body.satisfaction_rating = ticket.satisfaction_rating;
      }

      const res = await fetch(`/api/v1/tickets/${ticketId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Erreur");
      }

      toast({ title: "Statut mis à jour" });
      await fetchTicket();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="h-6 w-40 bg-muted rounded animate-pulse" />
        <div className="h-10 w-3/4 bg-muted rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 bg-muted rounded-2xl animate-pulse" />
            <div className="h-60 bg-muted rounded-2xl animate-pulse" />
          </div>
          <div className="h-60 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto px-4 py-24 max-w-5xl text-center">
        <h2 className="text-xl font-bold mb-2">Ticket introuvable</h2>
        <Button variant="outline" asChild>
          <Link href={backHref}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Retour
          </Link>
        </Button>
      </div>
    );
  }

  const isOwner = userRole === "owner";
  const isResolved = ticket.statut === "resolved" || ticket.statut === "closed";
  const activeWorkOrder = ticket.work_orders?.find((wo: any) => wo.statut !== "cancelled");

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href={backHref}
          className="group text-sm font-bold text-muted-foreground hover:text-indigo-600 flex items-center gap-2 transition-colors mb-4"
        >
          <div className="p-1.5 rounded-lg bg-muted group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </div>
          Retour
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            {ticket.reference && (
              <p className="font-mono text-xs font-bold text-muted-foreground tracking-wider">
                {ticket.reference}
              </p>
            )}
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              {ticket.titre}
            </h1>
            {ticket.category && (
              <Badge variant="secondary" className="capitalize">
                {CATEGORY_LABELS[ticket.category] || ticket.category}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <TicketStatusBadge status={ticket.statut} />
            <PriorityBadge priority={ticket.priorite} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <GlassCard className="p-6 border-border bg-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Description
            </h3>
            <p className="text-foreground whitespace-pre-wrap leading-relaxed">
              {ticket.description}
            </p>

            {/* Photos */}
            {ticket.photos && ticket.photos.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    Photos ({ticket.photos.length})
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {ticket.photos.map((photo: string, i: number) => (
                    <div key={i} className="h-20 w-20 rounded-lg bg-muted border border-border overflow-hidden">
                      <img src={photo} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </GlassCard>

          {/* Comments */}
          <TicketComments
            ticketId={ticketId}
            comments={ticket.ticket_comments || []}
            currentUserRole={userRole}
            isOwner={isOwner}
            onCommentAdded={fetchTicket}
            isResolved={isResolved}
          />

          {/* Satisfaction rating (if resolved and user is creator) */}
          {ticket.statut === "resolved" && userRole === "tenant" && (
            <GlassCard className="p-6 border-border bg-card">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">
                Satisfaction
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                Comment évaluez-vous la résolution de ce problème ?
              </p>
              <SatisfactionRating
                rating={ticket.satisfaction_rating}
                onChange={async (rating) => {
                  await fetch(`/api/v1/tickets/${ticketId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ satisfaction_rating: rating }),
                  });
                  fetchTicket();
                }}
                size="lg"
              />
            </GlassCard>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Classification charges récupérables (owner uniquement) */}
          {userRole === "owner" && (
            <TicketChargesClassification
              ticketId={ticketId}
              workOrderId={ticket.work_order_id ?? ticket.work_orders?.[0]?.id ?? null}
              initial={{
                is_tenant_chargeable: ticket.is_tenant_chargeable ?? null,
                charge_category_code: ticket.charge_category_code ?? null,
              }}
              canInjectCharges={
                ticket.statut === "resolved" || ticket.statut === "closed"
              }
            />
          )}

          {/* Ticket info */}
          <GlassCard className="p-5 border-border bg-card space-y-4">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
              Informations
            </h3>

            {ticket.property && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">Bien</p>
                  <p className="text-sm font-medium text-foreground">
                    {ticket.property.adresse_complete}
                  </p>
                </div>
              </div>
            )}

            {ticket.creator && (
              <div className="flex items-start gap-3">
                <UserCheck className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">Créé par</p>
                  <p className="text-sm font-medium text-foreground">
                    {ticket.creator.prenom} {ticket.creator.nom}
                  </p>
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
                    return isNaN(d.getTime())
                      ? "—"
                      : format(d, "d MMMM yyyy 'à' HH:mm", { locale: fr });
                  })()}
                </p>
              </div>
            </div>

            {ticket.resolved_at && (
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-muted-foreground">Résolu le</p>
                  <p className="text-sm font-medium text-foreground">
                    {format(new Date(ticket.resolved_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                  </p>
                </div>
              </div>
            )}

            {ticket.satisfaction_rating && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-1">Satisfaction</p>
                <SatisfactionRating rating={ticket.satisfaction_rating} readonly size="sm" />
              </div>
            )}
          </GlassCard>

          {/* Work order */}
          {activeWorkOrder && (
            <GlassCard className="p-5 border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
              <h3 className="text-sm font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                <Hammer className="h-4 w-4" />
                Intervention
              </h3>

              {activeWorkOrder.provider && (
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {activeWorkOrder.provider.prenom} {activeWorkOrder.provider.nom}
                  </p>
                  <p className="text-xs text-muted-foreground">Prestataire assigné</p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="font-bold capitalize">
                  {activeWorkOrder.statut}
                </Badge>
                {activeWorkOrder.date_intervention_prevue && (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(activeWorkOrder.date_intervention_prevue), "d MMM yyyy", { locale: fr })}
                  </span>
                )}
              </div>

              {/* Sprint 4 — Contacter le prestataire (owner ou tenant uniquement) */}
              {(userRole === "owner" || userRole === "tenant") &&
                activeWorkOrder.provider?.id &&
                ticket.property_id && (
                  <ContactProviderButton
                    ticketId={ticketId}
                    propertyId={ticket.property_id}
                    providerProfileId={activeWorkOrder.provider.id}
                    providerName={activeWorkOrder.provider.prenom || "le prestataire"}
                    viewerRole={userRole}
                  />
                )}
            </GlassCard>
          )}

          {/* Timeline */}
          <GlassCard className="p-5 border-border bg-card">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">
              Historique
            </h3>
            <TicketTimeline ticket={ticket} comments={ticket.ticket_comments} />
          </GlassCard>

          {/* Actions (owner only) */}
          {isOwner && (
            <GlassCard className="p-5 border-border bg-card space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
                Actions
              </h3>

              {/* Assign */}
              {!isResolved && !activeWorkOrder && (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setAssignModalOpen(true)}
                >
                  <UserCheck className="h-4 w-4" />
                  Assigner un prestataire
                </Button>
              )}

              {/* Create work order */}
              {!isResolved && !activeWorkOrder && (
                <CreateWorkOrderButton
                  ticketId={ticketId}
                  ticketCategory={ticket.category}
                  onCreated={fetchTicket}
                />
              )}

              {/* Resolve */}
              {!isResolved && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => handleStatusAction("resolve")}
                  disabled={!!actionLoading}
                >
                  Marquer comme résolu
                </Button>
              )}

              {/* Close */}
              {ticket.statut === "resolved" && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleStatusAction("close")}
                  disabled={!!actionLoading}
                >
                  Clôturer
                </Button>
              )}

              {/* Reopen */}
              {ticket.statut === "resolved" && (
                <Button
                  variant="outline"
                  className="w-full gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                  onClick={() => handleStatusAction("reopen")}
                  disabled={!!actionLoading}
                >
                  Rouvrir
                </Button>
              )}
            </GlassCard>
          )}
        </div>
      </div>

      {/* Assign modal */}
      <AssignProviderModal
        open={assignModalOpen}
        onOpenChange={setAssignModalOpen}
        ticketId={ticketId}
        ticketCategory={ticket.category}
        onAssigned={fetchTicket}
      />
    </div>
  );
}
