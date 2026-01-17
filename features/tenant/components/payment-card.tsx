"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { paymentSharesService, PaymentShare } from "../services/payment-shares.service";
import { CreditCard, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface PaymentCardProps {
  leaseId: string;
  month: string; // Format: YYYY-MM-01
}

export function PaymentCard({ leaseId, month }: PaymentCardProps) {
  const { toast } = useToast();
  const [paymentShare, setPaymentShare] = useState<PaymentShare | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    loadPaymentShare();
  }, [leaseId, month]);

  const loadPaymentShare = async () => {
    try {
      setLoading(true);
      const { own } = await paymentSharesService.getPaymentShares(leaseId, month);
      setPaymentShare(own);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement du paiement",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async () => {
    if (!paymentShare) return;

    try {
      setPaying(true);
      await paymentSharesService.pay(leaseId, {
        amount: paymentShare.due_amount,
        method: "cb",
        month,
        paymentShareId: paymentShare.id,
      });

      toast({
        title: "Succès",
        description: "Paiement initié avec succès",
      });
      await loadPaymentShare();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors du paiement",
        variant: "destructive",
      });
    } finally {
      setPaying(false);
    }
  };

  const handleToggleAutopay = async () => {
    if (!paymentShare) return;

    try {
      await paymentSharesService.toggleAutopay(
        leaseId,
        paymentShare.id,
        !paymentShare.autopay
      );

      toast({
        title: "Succès",
        description: paymentShare.autopay
          ? "Autopay désactivé"
          : "Autopay activé",
      });
      await loadPaymentShare();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paiement du mois</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!paymentShare) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Paiement du mois</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Aucun paiement à effectuer ce mois</p>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = {
    unpaid: { label: "Non payé", icon: XCircle, color: "destructive" },
    pending: { label: "En attente", icon: Clock, color: "warning" },
    partial: { label: "Partiel", icon: Clock, color: "warning" },
    paid: { label: "Payé", icon: CheckCircle2, color: "success" },
    failed: { label: "Échoué", icon: XCircle, color: "destructive" },
    scheduled: { label: "Programmé", icon: Clock, color: "default" },
  };

  const status = statusConfig[paymentShare.status];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Paiement du mois</CardTitle>
            <CardDescription>
              {new Date(month).toLocaleDateString("fr-FR", {
                month: "long",
                year: "numeric",
              })}
            </CardDescription>
          </div>
          <Badge variant={status.color as any}>
            <status.icon className="mr-1 h-3 w-3" />
            {status.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Montant dû</span>
          <span className="text-2xl font-bold">
            {paymentShare.due_amount.toFixed(2)} €
          </span>
        </div>

        {paymentShare.amount_paid > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Déjà payé</span>
            <span className="text-lg font-semibold">
              {paymentShare.amount_paid.toFixed(2)} €
            </span>
          </div>
        )}

        {paymentShare.status === "unpaid" && (
          <Button
            onClick={handlePay}
            disabled={paying}
            className="w-full"
            size="lg"
          >
            {paying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Traitement...
              </>
            ) : (
              <>
                <CreditCard className="mr-2 h-4 w-4" />
                Payer maintenant
              </>
            )}
          </Button>
        )}

        <Button
          variant="outline"
          onClick={handleToggleAutopay}
          className="w-full"
        >
          {paymentShare.autopay
            ? "Désactiver l'autopay"
            : "Activer l'autopay"}
        </Button>
      </CardContent>
    </Card>
  );
}

