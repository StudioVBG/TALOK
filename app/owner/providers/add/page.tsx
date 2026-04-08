'use client';

import { AddProviderForm } from '@/features/providers/components';
import { useSubscription } from '@/components/subscription';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AddProviderPage() {
  const { hasFeature } = useSubscription();
  const hasAccess = hasFeature('providers_management');

  if (!hasAccess) {
    return (
      <div className="container mx-auto max-w-2xl py-10">
        <Card className="border-amber-200">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Lock className="h-6 w-6 text-amber-600" />
              <CardTitle>Fonctionnalite reservee</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              L&apos;ajout de prestataires est disponible a partir du forfait Confort.
            </p>
            <Button asChild>
              <Link href="/owner/settings/subscription">Voir les forfaits</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ajouter un prestataire</h1>
        <p className="text-muted-foreground">
          Ajoutez un artisan de confiance a votre carnet d&apos;adresses.
        </p>
      </div>

      <AddProviderForm />
    </div>
  );
}
