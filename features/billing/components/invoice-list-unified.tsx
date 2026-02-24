"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { 
  FileText, 
  MoreHorizontal, 
  Send, 
  CreditCard, 
  Download, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Trash2,
  Loader2,
  FileCheck
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatCurrency } from "@/lib/helpers/format";

import { sendInvoiceAction, updateInvoiceStatusAction } from "../actions/invoices";
import { invoicesService } from "../services/invoices.service";

// Types
interface Invoice {
  id: string;
  periode: string;
  montant_total: number;
  statut: "draft" | "sent" | "viewed" | "partial" | "paid" | "late" | "cancelled";
  created_at: string;
  lease_id?: string;
  lease?: {
    property?: {
      adresse_complete: string;
    };
    tenant_name?: string;
  };
}

interface InvoiceListProps {
  invoices: Invoice[];
  variant: "owner" | "tenant";
}

export function InvoiceListUnified({ invoices, variant }: InvoiceListProps) {
  const { toast } = useToast();
  const [optimisticInvoices, setOptimisticInvoices] = useState(invoices);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);

  // Fonction pour formater la période (YYYY-MM -> Mois Année)
  const formatPeriod = (period: string) => {
    try {
      const [year, month] = period.split("-");
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return format(date, "MMMM yyyy", { locale: fr });
    } catch {
      return period;
    }
  };

  const handleSend = async (id: string) => {
    try {
      await sendInvoiceAction(id);
      toast({ title: "Facture envoyée au locataire !" });
    } catch {
      toast({ title: "Erreur lors de l'envoi", variant: "destructive" });
    }
  };

  const handleMarkPaid = async (id: string) => {
    try {
      await updateInvoiceStatusAction(id, "paid");
      toast({ title: "Facture marquée comme payée" });
    } catch {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) return;
    setDeletingId(id);
    try {
      await invoicesService.deleteInvoice(id);
      setOptimisticInvoices((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Facture supprimée", description: "La facture a été supprimée avec succès." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Une erreur est survenue lors de la suppression";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSendReminder = async (id: string) => {
    setSendingReminderId(id);
    try {
      const response = await fetch(`/api/invoices/${id}/remind`, { method: "POST" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'envoi");
      }
      toast({ title: "Relance envoyée", description: "Un email de rappel a été envoyé au locataire." });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Impossible d'envoyer la relance";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setSendingReminderId(null);
    }
  };

  return (
    <div className="space-y-4">
      {optimisticInvoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucune facture"
          description="Votre première facture apparaîtra ici à la prochaine échéance de votre bail."
        />
      ) : (
        <div className="grid gap-4">
          {optimisticInvoices.map((invoice) => (
            <Card key={invoice.id} className="overflow-hidden transition-all hover:shadow-md">
              <div className="flex flex-col sm:flex-row items-center p-4 gap-4">
                {/* Icone Statut */}
                <div className={`p-3 rounded-full shrink-0 ${
                  invoice.statut === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                  invoice.statut === 'late' ? 'bg-red-100 text-red-600' :
                  invoice.statut === 'partial' ? 'bg-amber-100 text-amber-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  <FileText className="h-6 w-6" />
                </div>

                {/* Infos Principales */}
                <div className="flex-1 text-center sm:text-left">
                  {variant === "owner" ? (
                    <Link href={`/owner/invoices/${invoice.id}`} className="font-semibold text-lg capitalize hover:underline block">
                      {formatPeriod(invoice.periode)}
                    </Link>
                  ) : (
                    <h4 className="font-semibold text-lg capitalize">
                      {formatPeriod(invoice.periode)}
                    </h4>
                  )}
                  <div className="flex flex-col sm:flex-row gap-1 sm:gap-4 text-sm text-slate-500">
                    <span>{invoice.lease?.property?.adresse_complete || "Adresse inconnue"}</span>
                    {variant === "owner" && (
                      <>
                        <span className="hidden sm:inline">•</span>
                        <span>{invoice.lease?.tenant_name || "Locataire inconnu"}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Montant & Statut */}
                <div className="flex flex-col items-center sm:items-end gap-1">
                  <span className="text-xl font-bold tracking-tight">
                    {formatCurrency(invoice.montant_total)}
                  </span>
                  <StatusBadge 
                    status={invoice.statut} 
                    type={
                      invoice.statut === 'paid' ? 'success' :
                      invoice.statut === 'late' ? 'error' :
                      invoice.statut === 'sent' || invoice.statut === 'viewed' ? 'info' :
                      invoice.statut === 'partial' ? 'warning' : 'neutral'
                    }
                  />
                </div>

                {/* Actions Contextuelles (Vertical Slice Magic 🪄) */}
                <div className="flex items-center gap-2 mt-4 sm:mt-0 pt-4 sm:pt-0 border-t sm:border-t-0 w-full sm:w-auto justify-end">
                  
                  {/* --- ACTIONS PROPRIÉTAIRE --- */}
                  {variant === "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem asChild>
                          <Link href={`/owner/invoices/${invoice.id}`}>
                            <FileText className="mr-2 h-4 w-4" /> Voir le détail
                          </Link>
                        </DropdownMenuItem>
                        {invoice.lease_id && (
                          <DropdownMenuItem asChild>
                            <Link href={`/owner/leases/${invoice.lease_id}`}>
                              <FileCheck className="mr-2 h-4 w-4" /> Voir le bail
                            </Link>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {invoice.statut === "draft" && (
                          <DropdownMenuItem onClick={() => handleSend(invoice.id)}>
                            <Send className="mr-2 h-4 w-4" /> Envoyer
                          </DropdownMenuItem>
                        )}
                        {variant === "owner" && (invoice.statut === "late" || invoice.statut === "sent") && (
                          <DropdownMenuItem
                            onClick={() => handleSendReminder(invoice.id)}
                            disabled={sendingReminderId === invoice.id}
                          >
                            {sendingReminderId === invoice.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="mr-2 h-4 w-4" />
                            )}
                            Envoyer une relance
                          </DropdownMenuItem>
                        )}
                        {invoice.statut !== "paid" && (invoice.statut as string) !== "cancelled" && (
                          <DropdownMenuItem onClick={() => handleMarkPaid(invoice.id)}>
                            <CheckCircle2 className="mr-2 h-4 w-4" /> Marquer payé
                          </DropdownMenuItem>
                        )}
                        {invoice.statut === "draft" && (
                          <DropdownMenuItem
                            onClick={() => handleDelete(invoice.id)}
                            disabled={deletingId === invoice.id}
                            className="text-destructive focus:text-destructive"
                          >
                            {deletingId === invoice.id ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            Supprimer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Download className="mr-2 h-4 w-4" /> Télécharger PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}

                  {/* --- ACTIONS LOCATAIRE --- */}
                  {variant === "tenant" && (
                    <>
                      {invoice.statut === 'paid' ? (
                         <Button variant="outline" size="sm" className="gap-2">
                           <Download className="h-4 w-4" /> Quittance
                         </Button>
                      ) : (
                         <Button size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                           <CreditCard className="h-4 w-4" /> Payer
                         </Button>
                      )}
                    </>
                  )}
                  
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
