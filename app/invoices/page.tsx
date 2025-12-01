"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { InvoicesList } from "@/features/billing/components/invoices-list";

export default function InvoicesPage() {
  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mes factures</h1>
          <p className="text-muted-foreground">Gérez vos factures de location</p>
        </div>

        <InvoicesList />
      </div>
    </ProtectedRoute>
  );
}

