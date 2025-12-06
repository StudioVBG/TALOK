"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Clock,
  AlertCircle,
  User,
  Calendar,
  FileText,
  CreditCard,
  Wrench,
  Star,
  CheckCircle2,
  XCircle,
  MapPin,
  ArrowRight,
  Loader2,
} from "lucide-react";
import {
  type WorkOrderStatus,
  type WorkOrderTimelineEvent,
  STATUS_LABELS,
  STATUS_COLORS,
  TIMELINE_EVENT_LABELS,
  formatEuros,
} from "@/lib/types/intervention-flow";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface FlowStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: "completed" | "current" | "pending" | "skipped";
  description?: string;
  date?: string;
}

interface InterventionFlowTrackerProps {
  workOrderId: string;
  currentStatus: WorkOrderStatus;
  timeline: WorkOrderTimelineEvent[];
  dates: {
    created_at: string;
    accepted_at: string | null;
    visit_scheduled_at: string | null;
    visit_completed_at: string | null;
    work_started_at: string | null;
    work_completed_at: string | null;
    closed_at: string | null;
  };
  costs?: {
    estimated: number | null;
    final: number | null;
  };
  className?: string;
}

/**
 * Tracker visuel du flux d'intervention
 */
export function InterventionFlowTracker({
  workOrderId,
  currentStatus,
  timeline,
  dates,
  costs,
  className,
}: InterventionFlowTrackerProps) {
  // Définir les étapes du flux
  const getFlowSteps = (): FlowStep[] => {
    const statusOrder: WorkOrderStatus[] = [
      'assigned',
      'accepted',
      'visit_scheduled',
      'visit_completed',
      'quote_sent',
      'quote_accepted',
      'deposit_paid',
      'work_scheduled',
      'in_progress',
      'work_completed',
      'fully_paid',
      'closed',
    ];

    const currentIndex = statusOrder.indexOf(currentStatus);

    const steps: FlowStep[] = [
      {
        id: 'assigned',
        label: 'Assignation',
        icon: <User className="h-4 w-4" />,
        status: currentIndex >= 0 ? 'completed' : 'pending',
        date: dates.created_at,
      },
      {
        id: 'accepted',
        label: 'Acceptation',
        icon: <Check className="h-4 w-4" />,
        status: currentIndex >= 1 ? 'completed' : currentIndex === 0 ? 'current' : 'pending',
        date: dates.accepted_at || undefined,
      },
      {
        id: 'visit',
        label: 'Visite',
        icon: <MapPin className="h-4 w-4" />,
        status: currentIndex >= 3 ? 'completed' : currentIndex >= 1 && currentIndex <= 2 ? 'current' : 'pending',
        date: dates.visit_completed_at || dates.visit_scheduled_at || undefined,
        description: dates.visit_scheduled_at 
          ? `Prévue le ${format(new Date(dates.visit_scheduled_at), 'dd/MM/yyyy', { locale: fr })}`
          : undefined,
      },
      {
        id: 'quote',
        label: 'Devis',
        icon: <FileText className="h-4 w-4" />,
        status: currentIndex >= 5 ? 'completed' : currentIndex >= 3 && currentIndex <= 4 ? 'current' : 'pending',
      },
      {
        id: 'deposit',
        label: 'Acompte (2/3)',
        icon: <CreditCard className="h-4 w-4" />,
        status: currentIndex >= 6 ? 'completed' : currentIndex === 5 ? 'current' : 'pending',
      },
      {
        id: 'work',
        label: 'Travaux',
        icon: <Wrench className="h-4 w-4" />,
        status: currentIndex >= 9 ? 'completed' : currentIndex >= 6 && currentIndex <= 8 ? 'current' : 'pending',
        date: dates.work_completed_at || dates.work_started_at || undefined,
      },
      {
        id: 'balance',
        label: 'Solde (1/3)',
        icon: <CreditCard className="h-4 w-4" />,
        status: currentIndex >= 10 ? 'completed' : currentIndex === 9 ? 'current' : 'pending',
      },
      {
        id: 'review',
        label: 'Avis',
        icon: <Star className="h-4 w-4" />,
        status: currentStatus === 'closed' ? 'completed' : currentIndex >= 10 ? 'current' : 'pending',
        date: dates.closed_at || undefined,
      },
    ];

    // Marquer comme skipped si annulé ou refusé
    if (['cancelled', 'refused', 'disputed'].includes(currentStatus)) {
      return steps.map((step, index) => ({
        ...step,
        status: index <= 1 ? step.status : 'skipped',
      }));
    }

    return steps;
  };

  const steps = getFlowSteps();

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Progression de l'intervention</CardTitle>
            <CardDescription>
              Statut actuel: {STATUS_LABELS[currentStatus]}
            </CardDescription>
          </div>
          <Badge className={cn(STATUS_COLORS[currentStatus].bg, STATUS_COLORS[currentStatus].text)}>
            {STATUS_LABELS[currentStatus]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Flow steps */}
        <div className="relative">
          {/* Progress line */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

          <div className="space-y-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative flex items-start gap-4"
              >
                {/* Step indicator */}
                <div
                  className={cn(
                    "relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white",
                    step.status === 'completed' && "border-green-500 bg-green-500 text-white",
                    step.status === 'current' && "border-orange-500 bg-orange-50 text-orange-600",
                    step.status === 'pending' && "border-slate-300 text-slate-400",
                    step.status === 'skipped' && "border-slate-200 bg-slate-100 text-slate-400"
                  )}
                >
                  {step.status === 'completed' ? (
                    <Check className="h-4 w-4" />
                  ) : step.status === 'current' ? (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ repeat: Infinity, duration: 2 }}
                    >
                      {step.icon}
                    </motion.div>
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "font-medium",
                        step.status === 'completed' && "text-green-700",
                        step.status === 'current' && "text-orange-700",
                        step.status === 'pending' && "text-slate-500",
                        step.status === 'skipped' && "text-slate-400 line-through"
                      )}
                    >
                      {step.label}
                    </span>
                    {step.status === 'current' && (
                      <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
                        En cours
                      </Badge>
                    )}
                  </div>
                  {step.date && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(step.date), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                    </p>
                  )}
                  {step.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Coûts */}
        {costs && (costs.estimated || costs.final) && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Montant</span>
              <span className="font-medium">
                {costs.final 
                  ? formatEuros(costs.final)
                  : costs.estimated 
                    ? `Estimé: ${formatEuros(costs.estimated)}`
                    : '-'
                }
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Timeline détaillée des événements
 */
export function InterventionTimeline({
  events,
  className,
}: {
  events: WorkOrderTimelineEvent[];
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayEvents = expanded ? events : events.slice(0, 5);

  const getEventIcon = (eventType: string) => {
    if (eventType.includes('accept') || eventType.includes('complete')) {
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
    if (eventType.includes('refuse') || eventType.includes('cancel') || eventType.includes('fail')) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (eventType.includes('visit')) {
      return <MapPin className="h-4 w-4 text-purple-500" />;
    }
    if (eventType.includes('quote')) {
      return <FileText className="h-4 w-4 text-blue-500" />;
    }
    if (eventType.includes('payment') || eventType.includes('paid') || eventType.includes('deposit') || eventType.includes('balance')) {
      return <CreditCard className="h-4 w-4 text-emerald-500" />;
    }
    if (eventType.includes('work')) {
      return <Wrench className="h-4 w-4 text-orange-500" />;
    }
    if (eventType.includes('review')) {
      return <Star className="h-4 w-4 text-yellow-500" />;
    }
    return <Clock className="h-4 w-4 text-slate-400" />;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">Historique</CardTitle>
        <CardDescription>{events.length} événements</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <AnimatePresence>
            {displayEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-start gap-3 text-sm"
              >
                <div className="mt-0.5">
                  {getEventIcon(event.event_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">
                    {TIMELINE_EVENT_LABELS[event.event_type] || event.event_type}
                  </p>
                  {event.description && (
                    <p className="text-muted-foreground text-xs">{event.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(new Date(event.created_at), "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                    {event.actor_role && event.actor_role !== 'system' && (
                      <span> • Par {event.actor_role === 'owner' ? 'propriétaire' : 'prestataire'}</span>
                    )}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {events.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-4"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Voir moins' : `Voir ${events.length - 5} de plus`}
            <ArrowRight className={cn("h-4 w-4 ml-1 transition-transform", expanded && "rotate-90")} />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

