'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FileText, ThumbsUp, ThumbsDown, Euro, Loader2, ExternalLink } from 'lucide-react';
import type { WorkOrderExtended } from '@/lib/types/providers';

interface QuoteApprovalCardProps {
  workOrder: WorkOrderExtended;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
}

export function QuoteApprovalCard({ workOrder, onApprove, onReject }: QuoteApprovalCardProps) {
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(action);
    setError(null);
    try {
      if (action === 'approve') await onApprove();
      else await onReject();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(null);
    }
  };

  if (workOrder.status !== 'quote_received') return null;

  const amount = workOrder.quote_amount_cents
    ? (workOrder.quote_amount_cents / 100).toFixed(2)
    : null;

  return (
    <Card className="border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/40 dark:bg-indigo-950/10">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Devis recu
          </CardTitle>
          <Badge className="bg-indigo-100 text-indigo-700">En attente de validation</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Amount */}
        {amount && (
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Euro className="h-6 w-6 text-indigo-600" />
            {amount} EUR
          </div>
        )}

        {/* Document link */}
        {workOrder.quote_document_id && (
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/documents/${workOrder.quote_document_id}/download`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Voir le devis PDF
            </a>
          </Button>
        )}

        {/* Provider info */}
        {workOrder.provider && (
          <p className="text-sm text-muted-foreground">
            Devis de {workOrder.provider.company_name} ({workOrder.provider.contact_name})
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => handleAction('approve')}
            disabled={loading !== null}
            className="flex-1"
          >
            {loading === 'approve' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ThumbsUp className="h-4 w-4 mr-2" />
            )}
            Approuver le devis
          </Button>
          <Button
            variant="outline"
            onClick={() => handleAction('reject')}
            disabled={loading !== null}
            className="flex-1"
          >
            {loading === 'reject' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ThumbsDown className="h-4 w-4 mr-2" />
            )}
            Refuser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
