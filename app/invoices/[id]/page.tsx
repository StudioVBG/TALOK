"use client";
// @ts-nocheck

import { useParams, useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { InvoiceDetail } from "@/features/billing/components/invoice-detail";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function InvoiceDetailPageContent() {
  const params = useParams();

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Détails de la facture</h1>
        <Link href="/invoices">
          <Button variant="ghost">Retour</Button>
        </Link>
      </div>

      {params.id && <InvoiceDetail invoiceId={params.id as string} />}
    </div>
  );
}

export default function InvoiceDetailPage() {
  return (
    <ProtectedRoute>
      <InvoiceDetailPageContent />
    </ProtectedRoute>
  );
}

