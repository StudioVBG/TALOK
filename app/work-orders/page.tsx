"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { WorkOrdersList } from "@/features/tickets/components/work-orders-list";
import { useAuth } from "@/lib/hooks/use-auth";

function WorkOrdersPageContent() {
  const { profile } = useAuth();

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mes interventions</h1>
        <p className="text-muted-foreground">Gérez vos interventions et ordres de travail</p>
      </div>

      <WorkOrdersList providerId={profile?.id} />
    </div>
  );
}

export default function WorkOrdersPage() {
  return (
    <ProtectedRoute allowedRoles={["provider", "admin"]}>
      <WorkOrdersPageContent />
    </ProtectedRoute>
  );
}

