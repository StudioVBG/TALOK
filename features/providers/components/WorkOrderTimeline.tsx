'use client';

import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
  type WorkOrderStatus,
  type WorkOrderExtended,
} from '@/lib/types/providers';
import {
  FileText, Send, FileCheck, ThumbsUp, ThumbsDown, Calendar,
  Play, CheckCircle2, Receipt, CreditCard, AlertTriangle, X,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const STATUS_ICONS: Record<WorkOrderStatus, React.ElementType> = {
  draft: FileText,
  quote_requested: Send,
  quote_received: FileCheck,
  quote_approved: ThumbsUp,
  quote_rejected: ThumbsDown,
  scheduled: Calendar,
  in_progress: Play,
  completed: CheckCircle2,
  invoiced: Receipt,
  paid: CreditCard,
  disputed: AlertTriangle,
  cancelled: X,
};

const STATUS_ORDER: WorkOrderStatus[] = [
  'draft', 'quote_requested', 'quote_received', 'quote_approved',
  'scheduled', 'in_progress', 'completed', 'invoiced', 'paid',
];

function getDateForStatus(wo: WorkOrderExtended, status: WorkOrderStatus): string | null {
  switch (status) {
    case 'draft': return wo.created_at;
    case 'quote_requested': return wo.requested_at;
    case 'quote_received': return wo.quote_received_at;
    case 'quote_approved': return wo.approved_at;
    case 'scheduled': return wo.scheduled_date;
    case 'in_progress': return wo.started_at;
    case 'completed': return wo.completed_at;
    case 'paid': return wo.paid_at;
    default: return null;
  }
}

interface WorkOrderTimelineProps {
  workOrder: WorkOrderExtended;
}

export function WorkOrderTimeline({ workOrder }: WorkOrderTimelineProps) {
  const currentIdx = STATUS_ORDER.indexOf(workOrder.status);
  // For rejected/cancelled/disputed, find the last reached step
  const effectiveIdx = currentIdx >= 0 ? currentIdx : STATUS_ORDER.length - 1;

  return (
    <div className="space-y-1">
      {STATUS_ORDER.map((status, idx) => {
        const Icon = STATUS_ICONS[status];
        const isReached = idx <= effectiveIdx;
        const isCurrent = status === workOrder.status;
        const date = getDateForStatus(workOrder, status);

        return (
          <div key={status} className="flex items-start gap-3">
            {/* Connector line + icon */}
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                  isCurrent
                    ? 'border-primary bg-primary text-primary-foreground'
                    : isReached
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20'
                    : 'border-muted bg-muted/50 text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              {idx < STATUS_ORDER.length - 1 && (
                <div
                  className={`h-6 w-0.5 ${
                    idx < effectiveIdx ? 'bg-emerald-500' : 'bg-muted'
                  }`}
                />
              )}
            </div>

            {/* Label + date */}
            <div className="flex-1 pb-2">
              <p
                className={`text-sm font-medium ${
                  isCurrent ? 'text-foreground' : isReached ? 'text-foreground/80' : 'text-muted-foreground'
                }`}
              >
                {WORK_ORDER_STATUS_LABELS[status]}
              </p>
              {date && isReached && (
                <p className="text-xs text-muted-foreground">
                  {format(new Date(date), 'dd MMM yyyy, HH:mm', { locale: fr })}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* Show cancelled/disputed/rejected if applicable */}
      {['cancelled', 'disputed', 'quote_rejected'].includes(workOrder.status) && (
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10 text-destructive">
              {workOrder.status === 'disputed' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : workOrder.status === 'quote_rejected' ? (
                <ThumbsDown className="h-4 w-4" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </div>
          </div>
          <div className="flex-1 pb-2">
            <p className="text-sm font-medium text-destructive">
              {WORK_ORDER_STATUS_LABELS[workOrder.status]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
