'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createWorkOrderSchema, type CreateWorkOrderInput } from '@/lib/validations/providers';
import { TRADE_CATEGORY_LABELS, type TradeCategory } from '@/lib/types/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save, ArrowLeft } from 'lucide-react';

interface PropertyOption {
  id: string;
  adresse_complete: string;
  ville: string;
}

interface ProviderOption {
  id: string;
  company_name: string;
  contact_name: string;
}

export function WorkOrderCreateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticket_id');
  const propertyId = searchParams.get('property_id');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateWorkOrderInput>({
    resolver: zodResolver(createWorkOrderSchema),
    defaultValues: {
      urgency: 'normal',
      is_deductible: true,
      ticket_id: ticketId ?? undefined,
      property_id: propertyId ?? undefined,
    },
  });

  // Load properties
  useEffect(() => {
    fetch('/api/properties')
      .then((r) => r.json())
      .then((data) => {
        const props = data.properties || data.data || [];
        setProperties(props);
      })
      .catch(() => setProperties([]));
  }, []);

  // Load providers (from address book)
  useEffect(() => {
    fetch('/api/providers?limit=100')
      .then((r) => r.json())
      .then((data) => {
        const provs = data.data || data.providers || [];
        setProviders(provs);
      })
      .catch(() => setProviders([]));
  }, []);

  // Pre-fill from ticket: arrive avec ?ticket_id=xxx sans property_id,
  // on charge le ticket pour en deduire bien, titre, description, categorie
  useEffect(() => {
    if (!ticketId || propertyId) return;
    fetch(`/api/v1/tickets/${ticketId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const ticket = data?.ticket ?? data;
        if (!ticket) return;
        if (ticket.property_id) {
          setValue('property_id', ticket.property_id, { shouldValidate: true });
        }
        if (ticket.titre && !watch('title')) {
          setValue('title', ticket.titre);
        }
        if (ticket.description && !watch('description')) {
          setValue('description', ticket.description);
        }
        if (ticket.category && !watch('category')) {
          setValue('category', ticket.category as TradeCategory);
        }
      })
      .catch(() => {
        // silent: l'utilisateur peut toujours selectionner manuellement
      });
  }, [ticketId, propertyId, setValue, watch]);

  const onSubmit = async (data: CreateWorkOrderInput) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erreur lors de la creation');
      }

      const result = await response.json();
      const woId = result.workOrder?.id;
      router.push(woId ? `/owner/work-orders/${woId}` : '/owner/work-orders');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Bien concerne */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Bien concerne</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Propriete *</Label>
            <Select
              value={watch('property_id') ?? ''}
              onValueChange={(v) => setValue('property_id', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selectionner un bien" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.adresse_complete}, {p.ville}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.property_id && (
              <p className="text-sm text-destructive">{errors.property_id.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Description des travaux */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Description des travaux</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              {...register('title')}
              placeholder="Ex: Fuite robinet cuisine"
            />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description detaillee *</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Decrivez le probleme ou les travaux a realiser..."
              rows={4}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categorie *</Label>
              <Select
                value={watch('category') ?? ''}
                onValueChange={(v) => setValue('category', v as TradeCategory, { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Corps de metier" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TRADE_CATEGORY_LABELS) as [TradeCategory, string][]).map(
                    ([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-destructive">{errors.category.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Urgence</Label>
              <Select
                value={watch('urgency') ?? 'normal'}
                onValueChange={(v) => setValue('urgency', v as 'low' | 'normal' | 'urgent' | 'emergency')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Basse</SelectItem>
                  <SelectItem value="normal">Normale</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="emergency">Urgence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prestataire */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prestataire (optionnel)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Assigner un prestataire</Label>
            <Select
              value={watch('provider_id') ?? ''}
              onValueChange={(v) => setValue('provider_id', v || null)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir plus tard" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.company_name} ({p.contact_name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Creer l&apos;ordre de travail
        </Button>
      </div>
    </form>
  );
}
