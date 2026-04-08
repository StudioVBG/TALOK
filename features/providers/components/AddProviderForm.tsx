'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createProviderSchema, type CreateProviderInput } from '@/lib/validations/providers';
import { TRADE_CATEGORY_LABELS, type TradeCategory } from '@/lib/types/providers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, ArrowLeft } from 'lucide-react';

export function AddProviderForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateProviderInput>({
    resolver: zodResolver(createProviderSchema),
    defaultValues: {
      trade_categories: [],
      certifications: [],
      service_radius_km: 30,
      response_time_hours: 48,
      emergency_available: false,
    },
  });

  const selectedCategories = watch('trade_categories') ?? [];

  const toggleCategory = (cat: TradeCategory) => {
    const current = selectedCategories;
    const updated = current.includes(cat)
      ? current.filter((c) => c !== cat)
      : [...current, cat];
    setValue('trade_categories', updated as [TradeCategory, ...TradeCategory[]], { shouldValidate: true });
  };

  const onSubmit = async (data: CreateProviderInput) => {
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Erreur lors de la creation');
      }

      router.push('/owner/providers');
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

      {/* Identite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Identite du prestataire</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Nom de la societe *</Label>
              <Input id="company_name" {...register('company_name')} placeholder="Ex: Plomberie Martin" />
              {errors.company_name && <p className="text-sm text-destructive">{errors.company_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="siret">SIRET</Label>
              <Input id="siret" {...register('siret')} placeholder="14 chiffres" maxLength={14} />
              {errors.siret && <p className="text-sm text-destructive">{errors.siret.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Nom du contact *</Label>
              <Input id="contact_name" {...register('contact_name')} placeholder="Jean Martin" />
              {errors.contact_name && <p className="text-sm text-destructive">{errors.contact_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telephone *</Label>
              <Input id="phone" {...register('phone')} placeholder="06 12 34 56 78" />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" {...register('email')} placeholder="contact@plomberie-martin.fr" />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Categories de metier */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Corps de metier *</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {(Object.entries(TRADE_CATEGORY_LABELS) as [TradeCategory, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={`cat-${key}`}
                  checked={selectedCategories.includes(key)}
                  onCheckedChange={() => toggleCategory(key)}
                />
                <Label htmlFor={`cat-${key}`} className="text-sm cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
          {errors.trade_categories && (
            <p className="text-sm text-destructive mt-2">{errors.trade_categories.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Localisation */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Localisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Adresse</Label>
            <Input id="address" {...register('address')} placeholder="12 rue de la Paix" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postal_code">Code postal</Label>
              <Input id="postal_code" {...register('postal_code')} placeholder="75001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Ville</Label>
              <Input id="city" {...register('city')} placeholder="Paris" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departement</Label>
              <Input id="department" {...register('department')} placeholder="75" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="service_radius_km">Rayon d&apos;intervention (km)</Label>
            <Input
              id="service_radius_km"
              type="number"
              {...register('service_radius_km', { valueAsNumber: true })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Assurances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Assurances et certifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="insurance_number">N RC Pro</Label>
              <Input id="insurance_number" {...register('insurance_number')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance_expiry">Expiration RC Pro</Label>
              <Input id="insurance_expiry" type="date" {...register('insurance_expiry')} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="decennale_number">N Decennale</Label>
              <Input id="decennale_number" {...register('decennale_number')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="decennale_expiry">Expiration Decennale</Label>
              <Input id="decennale_expiry" type="date" {...register('decennale_expiry')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description / notes</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Specialites, horaires habituels..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Disponibilite */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Disponibilite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="emergency_available"
              onCheckedChange={(checked) =>
                setValue('emergency_available', !!checked)
              }
            />
            <Label htmlFor="emergency_available" className="cursor-pointer">
              Disponible pour les urgences
            </Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="response_time_hours">Delai moyen de reponse (heures)</Label>
            <Input
              id="response_time_hours"
              type="number"
              {...register('response_time_hours', { valueAsNumber: true })}
            />
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
          Enregistrer le prestataire
        </Button>
      </div>
    </form>
  );
}
