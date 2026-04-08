'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowLeft, MapPin, User, Calendar, Euro, FileText, Send,
  Play, CreditCard, AlertTriangle, Loader2, Plus,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_COLORS,
  type WorkOrderExtended,
  type WorkOrderStatus,
} from '@/lib/types/providers';
import { WorkOrderTimeline } from '@/features/providers/components/WorkOrderTimeline';
import { QuoteApprovalCard } from '@/features/providers/components/QuoteApprovalCard';
import { UrgencyBadge } from '@/features/providers/components/UrgencyBadge';
import { ReviewForm } from '@/features/providers/components/ReviewForm';

export default function WorkOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workOrder, setWorkOrder] = useState<WorkOrderExtended | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/work-orders/${id}`);
      if (!res.ok) throw new Error('Ordre de travail non trouve');
      const data = await res.json();
      setWorkOrder(data.workOrder || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadWorkOrder();
  }, [loadWorkOrder]);

  const performAction = async (action: string, body?: Record<string, unknown>) => {
    setActionLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/work-orders/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erreur');
      }
      await loadWorkOrder();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl py-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!workOrder) {
    return (
      <div className="container mx-auto max-w-4xl py-6">
        <Alert variant="destructive">
          <AlertDescription>{error || 'Ordre de travail non trouve'}</AlertDescription>
        </Alert>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const wo = workOrder;
  const status = wo.status || 'draft';
  const quoteAmount = wo.quote_amount_cents ? (wo.quote_amount_cents / 100).toFixed(2) : null;
  const invoiceAmount = wo.invoice_amount_cents ? (wo.invoice_amount_cents / 100).toFixed(2) : null;

  return (
    <div className="container mx-auto max-w-4xl py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{wo.title || 'Ordre de travail'}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={WORK_ORDER_STATUS_COLORS[status]}>
                {WORK_ORDER_STATUS_LABELS[status]}
              </Badge>
              {wo.urgency && <UrgencyBadge urgency={wo.urgency} />}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm whitespace-pre-wrap">{wo.description || 'Aucune description'}</p>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {wo.property && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />
                    <span>{wo.property.adresse_complete}, {wo.property.ville}</span>
                  </div>
                )}
                {wo.provider && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span>{wo.provider.company_name}</span>
                  </div>
                )}
                {wo.scheduled_date && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {format(new Date(wo.scheduled_date), 'dd MMM yyyy', { locale: fr })}
                      {wo.scheduled_time_slot && ` (${wo.scheduled_time_slot})`}
                    </span>
                  </div>
                )}
                {quoteAmount && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Euro className="h-4 w-4 flex-shrink-0" />
                    <span>Devis: {quoteAmount} EUR</span>
                  </div>
                )}
                {invoiceAmount && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Euro className="h-4 w-4 flex-shrink-0" />
                    <span>Facture: {invoiceAmount} EUR</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quote approval card */}
          <QuoteApprovalCard
            workOrder={wo}
            onApprove={() => performAction('approve-quote')}
            onReject={() => performAction('reject-quote')}
          />

          {/* Intervention report */}
          {wo.intervention_report && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rapport d&apos;intervention</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{wo.intervention_report}</p>
                {wo.intervention_photos && wo.intervention_photos.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
                    {wo.intervention_photos.map((photo, i) => (
                      <div key={i} className="rounded-lg overflow-hidden border">
                        <img
                          src={photo.url}
                          alt={photo.caption || `Photo ${i + 1}`}
                          className="w-full h-32 object-cover"
                        />
                        {photo.caption && (
                          <p className="text-xs p-2 text-muted-foreground">{photo.caption}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Review form (after payment) */}
          {status === 'paid' && wo.provider?.id && (
            <ReviewForm
              providerProfileId={wo.provider_id || ''}
              workOrderId={wo.id}
              providerName={wo.provider.company_name || 'Prestataire'}
              onSubmit={async (data) => {
                await fetch(`/api/providers/${wo.provider_id}/reviews`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    ...data,
                    work_order_id: wo.id,
                  }),
                });
              }}
            />
          )}

          {/* Actions bar */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-wrap gap-2">
                {status === 'draft' && (
                  <Button
                    onClick={() => performAction('request-quote')}
                    disabled={actionLoading || !wo.provider_id}
                  >
                    {actionLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Demander un devis
                  </Button>
                )}
                {status === 'quote_approved' && (
                  <Button onClick={() => {
                    const date = prompt('Date (YYYY-MM-DD) :');
                    if (date) performAction('schedule', { scheduled_date: date });
                  }} disabled={actionLoading}>
                    <Calendar className="h-4 w-4 mr-2" />
                    Planifier
                  </Button>
                )}
                {status === 'invoiced' && (
                  <Button onClick={() => {
                    performAction('pay', { payment_method: 'bank_transfer' });
                  }} disabled={actionLoading}>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Marquer comme paye
                  </Button>
                )}
                {!['paid', 'cancelled'].includes(status) && (
                  <Button
                    variant="outline"
                    onClick={() => performAction('cancel')}
                    disabled={actionLoading}
                  >
                    Annuler
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — Timeline */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Avancement</CardTitle>
            </CardHeader>
            <CardContent>
              <WorkOrderTimeline workOrder={wo} />
            </CardContent>
          </Card>

          {/* Provider info */}
          {wo.provider && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Prestataire</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-semibold">{wo.provider.company_name}</p>
                <p className="text-sm text-muted-foreground">{wo.provider.contact_name}</p>
                <p className="text-sm text-muted-foreground">{wo.provider.email}</p>
                <p className="text-sm text-muted-foreground">{wo.provider.phone}</p>
                {wo.provider.avg_rating > 0 && (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="font-medium">{wo.provider.avg_rating}</span>
                    <span className="text-yellow-500">&#9733;</span>
                    {wo.provider.is_verified && (
                      <Badge variant="outline" className="ml-2 text-xs">Verifie</Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Ticket link */}
          {wo.ticket_id && (
            <Card>
              <CardContent className="py-4">
                <Link href={`/owner/tickets/${wo.ticket_id}`}>
                  <Button variant="outline" className="w-full" size="sm">
                    <FileText className="h-4 w-4 mr-2" />
                    Voir le ticket associe
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
