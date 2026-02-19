"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Plus,
  ChevronRight,
  Euro,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { useOwnerData } from "../_data/OwnerDataProvider";

interface Invoice {
  id: string;
  number: string;
  tenant_name: string;
  property_address: string;
  amount: number;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  due_date: string;
  created_at: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  draft: { label: "Brouillon", icon: FileText, className: "bg-slate-100 text-slate-700" },
  sent: { label: "Envoyée", icon: Send, className: "bg-blue-100 text-blue-700" },
  paid: { label: "Payée", icon: CheckCircle2, className: "bg-green-100 text-green-700" },
  overdue: { label: "En retard", icon: AlertCircle, className: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", icon: Clock, className: "bg-slate-100 text-slate-500" },
};

export default function OwnerInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInvoices() {
      try {
        const res = await fetch("/api/owner/invoices");
        if (res.ok) {
          const data = await res.json();
          setInvoices(data.invoices || []);
        }
      } catch (error) {
        console.error("Erreur chargement factures:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInvoices();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Factures</h1>
          <p className="text-muted-foreground">
            Gérez vos factures et quittances
          </p>
        </div>
        <Button asChild>
          <Link href="/owner/invoices/new">
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle facture
          </Link>
        </Button>
      </div>

      {/* List */}
      {invoices.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune facture</h3>
            <p className="text-muted-foreground mb-4">
              Vous n&apos;avez pas encore créé de facture.
            </p>
            <Button asChild>
              <Link href="/owner/invoices/new">
                <Plus className="h-4 w-4 mr-2" />
                Créer une facture
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice, index) => {
            const status = statusConfig[invoice.status] || statusConfig.draft;
            const StatusIcon = status.icon;
            return (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/owner/invoices/${invoice.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-lg bg-blue-100">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">
                            {invoice.number || "Brouillon"}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {invoice.tenant_name} &middot; {invoice.property_address}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={status.className}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Échéance :{" "}
                              {new Date(invoice.due_date).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-lg">
                          {invoice.amount.toLocaleString("fr-FR", {
                            style: "currency",
                            currency: "EUR",
                          })}
                        </span>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
