'use client';

import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Zap } from 'lucide-react';
import { URGENCY_CONFIG, type WorkOrderUrgency } from '@/lib/types/providers';

interface UrgencyBadgeProps {
  urgency: WorkOrderUrgency;
  className?: string;
}

export function UrgencyBadge({ urgency, className }: UrgencyBadgeProps) {
  const config = URGENCY_CONFIG[urgency];
  return (
    <Badge variant="outline" className={`${config.color} ${className ?? ''}`}>
      {urgency === 'emergency' && <Zap className="h-3 w-3 mr-1" />}
      {urgency === 'urgent' && <AlertTriangle className="h-3 w-3 mr-1" />}
      {config.label}
    </Badge>
  );
}
