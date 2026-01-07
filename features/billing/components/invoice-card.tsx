"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { invoicesService } from "../services/invoices.service";
import type { Invoice } from "@/lib/types";
import { formatCurrency, formatPeriod } from "@/lib/helpers/format";
import { 
  Trash2, 
  ExternalLink, 
  Send, 
  CheckCircle, 
  Loader2,
  Clock,
  AlertTriangle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from "lucide-react";

interface InvoiceCardProps {
  invoice: Invoice;
  onDelete?: () => void;
  onStatusChange?: () => void;
  variant?: "owner" | "tenant";
}

export function InvoiceCard({ 
  invoice, 
  onDelete, 
  onStatusChange,
  variant = "owner" 
}: InvoiceCardProps) {
  const { toast } = useToast();
  const [deleting, setDeleting] = useState(false);
  const [sending, setSending] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette facture ?")) return;

    setDeleting(true);
    try {
      await invoicesService.deleteInvoice(invoice.id);
      toast({
        title: "Facture supprimée",
        description: "La facture a été supprimée avec succès.",
      });
      onDelete?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  // Envoyer une relance au locataire
  const handleSendReminder = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/remind`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi");
      }

      toast({
        title: "Relance envoyée",
        description: "Un email de rappel a été envoyé au locataire.",
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer la relance.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Marquer comme payée
  const handleMarkPaid = async () => {
    if (!confirm("Confirmer que cette facture a été payée ?")) return;

    setMarkingPaid(true);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/mark-paid`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la mise à jour");
      }

      toast({
        title: "Facture marquée payée",
        description: "Le statut a été mis à jour avec succès.",
      });
      onStatusChange?.();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    } finally {
      setMarkingPaid(false);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: "Brouillon",
      sent: "Envoyée",
      paid: "Payée",
      late: "En retard",
      cancelled: "Annulée",
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800",
      sent: "bg-blue-100 text-blue-800",
      paid: "bg-green-100 text-green-800",
      late: "bg-red-100 text-red-800",
      cancelled: "bg-gray-100 text-gray-500",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="h-4 w-4" />;
      case "late":
        return <AlertTriangle className="h-4 w-4" />;
      case "sent":
        return <Clock className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const isOverdue = invoice.statut === "late" || invoice.statut === "sent";
  const canRemind = variant === "owner" && isOverdue && invoice.statut !== "paid";
  const canMarkPaid = variant === "owner" && invoice.statut !== "paid" && (invoice.statut as string) !== "cancelled";

  return (
    <Card className={invoice.statut === "late" ? "border-red-200 bg-red-50/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              Facture {formatPeriod(invoice.periode)}
              {invoice.statut === "late" && (
                <AlertTriangle className="h-4 w-4 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>Période : {formatPeriod(invoice.periode)}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${getStatusColor(invoice.statut)}`}>
              {getStatusIcon(invoice.statut)}
            {getStatusLabel(invoice.statut)}
          </span>
            
            {variant === "owner" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/owner/invoices/${invoice.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Voir détails
                    </Link>
                  </DropdownMenuItem>
                  
                  {canRemind && (
                    <DropdownMenuItem 
                      onClick={handleSendReminder}
                      disabled={sending}
                    >
                      {sending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Envoyer relance
                    </DropdownMenuItem>
                  )}
                  
                  {canMarkPaid && (
                    <DropdownMenuItem 
                      onClick={handleMarkPaid}
                      disabled={markingPaid}
                    >
                      {markingPaid ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      )}
                      Marquer payée
                    </DropdownMenuItem>
                  )}
                  
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem 
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-red-600 focus:text-red-600"
                  >
                    {deleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Loyer :</span>
            <span className="font-medium">{formatCurrency(invoice.montant_loyer)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Charges :</span>
            <span className="font-medium">{formatCurrency(invoice.montant_charges)}</span>
          </div>
          <div className="flex justify-between border-t pt-2">
            <span className="text-muted-foreground font-medium">Total :</span>
            <span className="font-bold text-lg">{formatCurrency(invoice.montant_total)}</span>
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <Link href={`/owner/invoices/${invoice.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              <ExternalLink className="mr-2 h-4 w-4" />
              Voir détails
            </Button>
          </Link>
          
          {canRemind && (
            <Button 
              variant="secondary" 
              onClick={handleSendReminder}
              disabled={sending}
              title="Envoyer une relance"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
          
          {canMarkPaid && (
            <Button 
              variant="default"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleMarkPaid}
              disabled={markingPaid}
              title="Marquer comme payée"
            >
              {markingPaid ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
          </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
