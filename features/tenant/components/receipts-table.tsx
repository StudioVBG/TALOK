"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveTable } from "@/components/ui/responsive-table";
import { Download, FileText, Loader2, Check } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { paymentSharesService } from "../services/payment-shares.service";

interface Receipt {
  id: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  paid_at: string;
  payment_method?: string;
  pdf_url?: string | null;
  payment_id?: string;
}

interface ReceiptsTableProps {
  leaseId: string;
  month?: string;
}

export function ReceiptsTable({ leaseId, month }: ReceiptsTableProps) {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadReceipts();
  }, [leaseId, month]);

  const loadReceipts = async () => {
    try {
      setLoading(true);
      const data = await paymentSharesService.getReceipts(leaseId, month);
      setReceipts(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du chargement des quittances",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (receipt: Receipt) => {
    if (!receipt.payment_id) {
      toast({
        title: "Erreur",
        description: "Impossible de télécharger cette quittance",
        variant: "destructive",
      });
      return;
    }

    try {
      setDownloadingId(receipt.id);
      
      // Appeler l'API pour récupérer le PDF
      const response = await fetch(`/api/payments/${receipt.payment_id}/receipt`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors du téléchargement");
      }
      
      // Récupérer le blob PDF
      const blob = await response.blob();
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `quittance-${receipt.periode}.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Nettoyer
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "Téléchargement réussi",
        description: "Votre quittance a été téléchargée",
      });
    } catch (error: unknown) {
      console.error("Erreur téléchargement:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du téléchargement",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const formatPaymentMethod = (method?: string) => {
    switch (method) {
      case "cb":
      case "card":
        return "Carte bancaire";
      case "virement":
        return "Virement";
      case "prelevement":
        return "Prélèvement";
      case "especes":
        return "Espèces";
      case "cheque":
        return "Chèque";
      default:
        return "-";
    }
  };

  const columns = [
    {
      header: "Période",
      cell: (receipt: Receipt) => (
        <span className="font-medium">
          {new Date(receipt.periode + "-01").toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          })}
        </span>
      )
    },
    {
      header: "Loyer",
      cell: (receipt: Receipt) => `${receipt.montant_loyer.toFixed(2)} €`
    },
    {
      header: "Charges",
      cell: (receipt: Receipt) => `${receipt.montant_charges.toFixed(2)} €`
    },
    {
      header: "Total",
      cell: (receipt: Receipt) => (
        <span className="font-semibold text-primary">
          {receipt.montant_total.toFixed(2)} €
        </span>
      )
    },
    {
      header: "Payé le",
      cell: (receipt: Receipt) => new Date(receipt.paid_at).toLocaleDateString("fr-FR")
    },
    {
      header: "Moyen",
      cell: (receipt: Receipt) => formatPaymentMethod(receipt.payment_method)
    },
    {
      header: "Quittance",
      className: "text-right",
      cell: (receipt: Receipt) => (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload(receipt)}
            disabled={downloadingId === receipt.id || !receipt.payment_id}
            className="gap-2"
          >
            {downloadingId === receipt.id ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Génération...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Télécharger</span>
              </>
            )}
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quittances
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (receipts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Quittances
          </CardTitle>
          <CardDescription>
            Aucune quittance disponible pour le moment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Les quittances apparaîtront ici après chaque paiement de loyer</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Quittances
        </CardTitle>
        <CardDescription>
          Historique de vos paiements et quittances
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveTable
          data={receipts}
          columns={columns}
          keyExtractor={(receipt) => receipt.id}
          emptyMessage="Aucune quittance disponible"
        />
      </CardContent>
    </Card>
  );
}
