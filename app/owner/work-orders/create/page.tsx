'use client';

import { WorkOrderCreateForm } from '@/features/providers/components';
import { PlanGate } from '@/components/subscription';

export default function CreateWorkOrderPage() {
  return (
    <PlanGate feature="work_orders" mode="blur">
      <div className="container mx-auto max-w-3xl py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nouvel ordre de travail</h1>
          <p className="text-muted-foreground">
            Creez un ordre de travail et assignez-le a un prestataire.
          </p>
        </div>

        <WorkOrderCreateForm />
      </div>
    </PlanGate>
  );
}
