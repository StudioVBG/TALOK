"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { 
  CheckCircle2, Clock, AlertCircle, XCircle, 
  FileText, Receipt, Home, Users, Ticket, MessageSquare,
  Calendar, Edit, Trash2, Eye, Send, Download
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Types
export type TimelineEventType = 
  | "created"
  | "updated"
  | "deleted"
  | "viewed"
  | "sent"
  | "received"
  | "paid"
  | "pending"
  | "cancelled"
  | "completed"
  | "signed"
  | "uploaded"
  | "downloaded"
  | "comment"
  | "status_change"
  | "custom";

export type TimelineEventStatus = "success" | "warning" | "error" | "info" | "neutral";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description?: string;
  date: string;
  user?: {
    name: string;
    avatar?: string;
  };
  metadata?: Record<string, any>;
  status?: TimelineEventStatus;
  icon?: ReactNode;
}

// Configuration des types d'événements
const eventConfig: Record<TimelineEventType, {
  icon: typeof CheckCircle2;
  defaultStatus: TimelineEventStatus;
}> = {
  created: { icon: FileText, defaultStatus: "success" },
  updated: { icon: Edit, defaultStatus: "info" },
  deleted: { icon: Trash2, defaultStatus: "error" },
  viewed: { icon: Eye, defaultStatus: "neutral" },
  sent: { icon: Send, defaultStatus: "info" },
  received: { icon: Receipt, defaultStatus: "success" },
  paid: { icon: CheckCircle2, defaultStatus: "success" },
  pending: { icon: Clock, defaultStatus: "warning" },
  cancelled: { icon: XCircle, defaultStatus: "error" },
  completed: { icon: CheckCircle2, defaultStatus: "success" },
  signed: { icon: FileText, defaultStatus: "success" },
  uploaded: { icon: Download, defaultStatus: "info" },
  downloaded: { icon: Download, defaultStatus: "neutral" },
  comment: { icon: MessageSquare, defaultStatus: "neutral" },
  status_change: { icon: AlertCircle, defaultStatus: "info" },
  custom: { icon: Calendar, defaultStatus: "neutral" },
};

const statusColors: Record<TimelineEventStatus, {
  bg: string;
  border: string;
  text: string;
  icon: string;
}> = {
  success: {
    bg: "bg-green-100 dark:bg-green-900/30",
    border: "border-green-500",
    text: "text-green-700 dark:text-green-300",
    icon: "text-green-600",
  },
  warning: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    border: "border-yellow-500",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: "text-yellow-600",
  },
  error: {
    bg: "bg-red-100 dark:bg-red-900/30",
    border: "border-red-500",
    text: "text-red-700 dark:text-red-300",
    icon: "text-red-600",
  },
  info: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    border: "border-blue-500",
    text: "text-blue-700 dark:text-blue-300",
    icon: "text-blue-600",
  },
  neutral: {
    bg: "bg-gray-100 dark:bg-gray-800",
    border: "border-gray-300 dark:border-gray-600",
    text: "text-gray-700 dark:text-gray-300",
    icon: "text-gray-500",
  },
};

interface TimelineItemProps {
  event: TimelineEvent;
  isLast?: boolean;
  animate?: boolean;
  index?: number;
}

function TimelineItem({ event, isLast, animate = true, index = 0 }: TimelineItemProps) {
  const config = eventConfig[event.type];
  const status = event.status || config.defaultStatus;
  const colors = statusColors[status];
  const Icon = event.icon ? null : config.icon;

  const formattedDate = new Date(event.date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const content = (
    <div className="flex gap-4">
      {/* Ligne verticale et icône */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center border-2",
            colors.bg,
            colors.border
          )}
        >
          {event.icon || (Icon && <Icon className={cn("h-5 w-5", colors.icon)} />)}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border mt-2" />
        )}
      </div>

      {/* Contenu */}
      <div className={cn("flex-1 pb-8", isLast && "pb-0")}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-medium text-sm">{event.title}</p>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {event.description}
              </p>
            )}
          </div>
          <time className="text-xs text-muted-foreground whitespace-nowrap">
            {formattedDate}
          </time>
        </div>

        {/* Métadonnées */}
        {event.user && (
          <div className="flex items-center gap-2 mt-2">
            {event.user.avatar ? (
              <img
                src={event.user.avatar}
                alt={event.user.name}
                className="w-5 h-5 rounded-full"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {event.user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {event.user.name}
            </span>
          </div>
        )}

        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {Object.entries(event.metadata).map(([key, value]) => (
              <Badge key={key} variant="outline" className="text-xs">
                {key}: {String(value)}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

interface TimelineProps {
  events: TimelineEvent[];
  animate?: boolean;
  className?: string;
  emptyMessage?: string;
}

/**
 * Composant Timeline pour afficher l'historique des événements
 * 
 * @example
 * <Timeline events={[
 *   { id: "1", type: "created", title: "Bail créé", date: "2025-01-15" },
 *   { id: "2", type: "signed", title: "Bail signé", date: "2025-01-20" },
 * ]} />
 */
export function Timeline({
  events,
  animate = true,
  className,
  emptyMessage = "Aucun événement",
}: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  // Trier par date décroissante
  const sortedEvents = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className={className}>
      {sortedEvents.map((event, index) => (
        <TimelineItem
          key={event.id}
          event={event}
          isLast={index === sortedEvents.length - 1}
          animate={animate}
          index={index}
        />
      ))}
    </div>
  );
}

// Version horizontale pour les étapes
interface StepTimelineProps {
  steps: Array<{
    id: string;
    title: string;
    description?: string;
    status: "completed" | "current" | "upcoming";
  }>;
  className?: string;
}

export function StepTimeline({ steps, className }: StepTimelineProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          {/* Cercle */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2",
                step.status === "completed" && "bg-primary border-primary text-primary-foreground",
                step.status === "current" && "border-primary text-primary bg-primary/10",
                step.status === "upcoming" && "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {step.status === "completed" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </div>
            <div className="mt-2 text-center">
              <p className={cn(
                "text-xs font-medium",
                step.status === "upcoming" && "text-muted-foreground"
              )}>
                {step.title}
              </p>
              {step.description && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </p>
              )}
            </div>
          </div>

          {/* Ligne de connexion */}
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-0.5 w-16 mx-2",
                step.status === "completed" ? "bg-primary" : "bg-border"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Version compacte pour les listes
interface CompactTimelineProps {
  events: TimelineEvent[];
  limit?: number;
  className?: string;
}

export function CompactTimeline({ events, limit = 5, className }: CompactTimelineProps) {
  const sortedEvents = [...events]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);

  return (
    <div className={cn("space-y-2", className)}>
      {sortedEvents.map((event) => {
        const config = eventConfig[event.type];
        const status = event.status || config.defaultStatus;
        const colors = statusColors[status];
        const Icon = config.icon;

        return (
          <div
            key={event.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <div className={cn("p-1.5 rounded-full", colors.bg)}>
              <Icon className={cn("h-3.5 w-3.5", colors.icon)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{event.title}</p>
            </div>
            <time className="text-xs text-muted-foreground">
              {new Date(event.date).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "short",
              })}
            </time>
          </div>
        );
      })}
    </div>
  );
}

export default Timeline;

