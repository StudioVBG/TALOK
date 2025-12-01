"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { LeasesList } from "@/features/leases/components/leases-list";

export default function LeasesPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mes baux</h1>
          <p className="text-muted-foreground">Gérez vos baux de location</p>
        </div>

        <LeasesList />
      </div>
    </ProtectedRoute>
  );
}

