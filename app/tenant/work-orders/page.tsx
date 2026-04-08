'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Wrench, Calendar, MapPin, Clock, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
  URGENCY_CONFIG,
  type WorkOrderStatus,
  type WorkOrderUrgency,
} from '@/lib/types/providers';

interface TenantWorkOrder {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: WorkOrderUrgency;
  status: WorkOrderStatus;
  scheduled_date: string | null;
  scheduled_time_slot: string | null;
  started_at: string | null;
  completed_at: string | null;
  property?: {
    id: string;
    adresse_complete: string;
    ville: string;
  };
}

export default function TenantWorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<TenantWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  async function fetchWorkOrders() {
    try {
      const res = await fetch('/api/work-orders?tenant=true');
      if (!res.ok) throw new Error('Erreur chargement');
      const data = await res.json();
      setWorkOrders(data.workOrders || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Interventions prevues</h1>
        <p className="text-muted-foreground">
          Interventions planifiees dans votre logement
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {workOrders.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">Aucune intervention prevue</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              Vous serez informe lorsqu&apos;une intervention sera planifiee dans votre logement.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workOrders.map((wo) => {
            const StatusIcon = wo.status === 'completed' ? CheckCircle2
              : wo.status === 'in_progress' ? Clock
              : Calendar;

            return (
              <Card key={wo.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl ${
                      wo.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-600'
                        : wo.status === 'in_progress'
                        ? 'bg-orange-100 text-orange-600'
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      <StatusIcon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold">{wo.title || 'Intervention'}</h3>
                        <Badge className={WORK_ORDER_STATUS_COLORS[wo.status]}>
                          {WORK_ORDER_STATUS_LABELS[wo.status]}
                        </Badge>
                        {wo.urgency && wo.urgency !== 'normal' && (
                          <Badge variant="outline" className={URGENCY_CONFIG[wo.urgency].color}>
                            {URGENCY_CONFIG[wo.urgency].label}
                          </Badge>
                        )}
                      </div>

                      {wo.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {wo.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        {wo.property && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {wo.property.adresse_complete}
                          </div>
                        )}
                        {wo.scheduled_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {format(new Date(wo.scheduled_date), 'dd MMM yyyy', { locale: fr })}
                            {wo.scheduled_time_slot && ` (${wo.scheduled_time_slot})`}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
