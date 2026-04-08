"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  UserCheck,
  Wrench,
  XCircle,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  type: "status_change" | "comment" | "assignment" | "work_order";
  status?: string;
  date: string;
  actor?: string;
  description?: string;
}

interface TicketTimelineProps {
  ticket: {
    statut: string;
    created_at: string;
    resolved_at?: string | null;
    closed_at?: string | null;
  };
  comments?: Array<{
    created_at: string;
    author?: { prenom: string; nom: string } | null;
    content: string;
  }>;
}

const STATUS_ICONS: Record<string, typeof AlertCircle> = {
  open: AlertCircle,
  acknowledged: Eye,
  assigned: UserCheck,
  in_progress: Wrench,
  resolved: CheckCircle2,
  closed: CheckCircle2,
  rejected: XCircle,
  reopened: RotateCcw,
};

const STATUS_LABELS: Record<string, string> = {
  open: "Ticket ouvert",
  acknowledged: "Pris en compte",
  assigned: "Assigné",
  in_progress: "En cours de traitement",
  resolved: "Résolu",
  closed: "Clôturé",
  rejected: "Rejeté",
  reopened: "Rouvert",
};

export function TicketTimeline({ ticket, comments = [] }: TicketTimelineProps) {
  const events: TimelineEvent[] = [];

  // Created
  events.push({
    type: "status_change",
    status: "open",
    date: ticket.created_at,
    description: "Ticket créé",
  });

  // Comments
  comments.forEach((comment) => {
    events.push({
      type: "comment",
      date: comment.created_at,
      actor: comment.author ? `${comment.author.prenom} ${comment.author.nom}` : undefined,
      description: comment.content.length > 80
        ? comment.content.substring(0, 80) + "..."
        : comment.content,
    });
  });

  // Resolved
  if (ticket.resolved_at) {
    events.push({
      type: "status_change",
      status: "resolved",
      date: ticket.resolved_at,
      description: "Ticket résolu",
    });
  }

  // Closed
  if (ticket.closed_at) {
    events.push({
      type: "status_change",
      status: "closed",
      date: ticket.closed_at,
      description: "Ticket clôturé",
    });
  }

  // Sort by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="space-y-0">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        const Icon = event.type === "comment"
          ? MessageSquare
          : STATUS_ICONS[event.status || "open"] || Clock;

        const isStatusChange = event.type === "status_change";

        return (
          <div key={index} className="flex gap-3">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                  isStatusChange
                    ? "bg-blue-100 dark:bg-blue-900/30"
                    : "bg-muted"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isStatusChange
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-muted-foreground"
                  )}
                />
              </div>
              {!isLast && (
                <div className="w-px h-full min-h-[24px] bg-border" />
              )}
            </div>

            {/* Content */}
            <div className="pb-4 min-w-0">
              <p className={cn(
                "text-sm",
                isStatusChange ? "font-semibold text-foreground" : "text-muted-foreground"
              )}>
                {event.description}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                {event.actor && (
                  <span className="text-xs text-muted-foreground font-medium">
                    {event.actor}
                  </span>
                )}
                <span className="text-xs text-muted-foreground/60">
                  {(() => {
                    const d = new Date(event.date);
                    return isNaN(d.getTime())
                      ? "—"
                      : format(d, "d MMM yyyy 'à' HH:mm", { locale: fr });
                  })()}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
