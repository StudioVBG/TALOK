"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  FileText,
  Euro,
  Calendar,
  Building2,
  User,
  Download,
  Send,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Printer,
  Mail,
  CreditCard,
  Banknote,
  Plus,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ManualPaymentDialog } from "@/components/payments";

const statusConfig = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: FileText },
  sent: { label: "Envoyée", color: "bg-blue-100 text-blue-700", icon: Send },
  paid: { label: "Payée", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  late: { label: "En retard", color: "bg-red-100 text-red-700", icon: AlertCircle },
  partial: { label: "Partielle", color: "bg-amber-100 text-amber-700", icon: Clock },
};

interface Invoice {
  id: string;
  reference: string;
  periode: string;
  montant_total: number;
  montant_loyer: number;
  montant_charges: number;
  montant_paye?: number;
  statut: keyof typeof statusConfig;
  date_echeance: string;
  date_emission: string;
  date_paiement?: string;
  property?: {
    id: string;
    adresse_complete: string;
  };
  lease?: {
    id: string;
    type_bail: string;
  };
  tenant?: {
    prenom: string;
    nom: string;
    email: string;
  };
  owner?: {
    prenom: string;
    nom: string;
  };
  payments?: Array<{
    id: string;
    montant: number;
    moyen: string;
    date_paiement: string;
    statut: string;
  }>;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);

  const fetchInvoice = async () => {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data.invoice || data);
      }
    } catch (error) {
      console.error("Erreur chargement facture:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (invoiceId) fetchInvoice();
  }, [invoiceId]);

  // Refresh after payment
  const handlePaymentComplete = () => {
    fetchInvoice();
    setShowPaymentDialog(false);
  };

  const handleSendReminder = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/remind`, {
        method: "POST",
      });

      if (response.ok) {
        toast({ title: "Rappel envoyé", description: "Le locataire a été notifié." });
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'envoyer le rappel", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const handleDownload = async () => {
    try {
      const startResponse = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "invoice",
          format: "csv",
          filters: { invoiceId }
        })
      });

      if (!startResponse.ok) throw new Error("Erreur initialisation export");
      const { jobId } = await startResponse.json();

      // Poll
      const poll = async () => {
        const statusResponse = await fetch(`/api/exports/${jobId}`);
        const job = await statusResponse.json();

        if (job.status === "completed") {
          window.location.href = `/api/exports/${jobId}/download`;
          toast({ title: "Export réussi" });
        } else if (job.status === "failed") {
          toast({ title: "Erreur", description: job.error_message, variant: "destructive" });
        } else {
          setTimeout(poll, 1000);
        }
      };

      poll();
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm">
          <CardContent className="py-16 text-center">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Facture introuvable</h3>
            <p className="text-muted-foreground mb-6">
              Cette facture n'existe pas ou vous n'y avez pas accès.
            </p>
            <Button asChild>
              <Link href="/owner/money">Retour aux finances</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[invoice.statut] || statusConfig.draft;
  const StatusIcon = status.icon;
  const resteDu = invoice.montant_total - (invoice.montant_paye || 0);
  const isPaid = invoice.statut === "paid";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 min-h-screen"
    >
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/owner/money"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux finances
          </Link>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Badge className={cn(status.color, "flex items-center gap-1")}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
              <h1 className="text-2xl font-bold">Facture {invoice.reference}</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Période: {invoice.periode}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Télécharger
              </Button>
              {!isPaid && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleSendReminder}
                    disabled={sending}
                  >
                    {sending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Rappel
                  </Button>
                  <Button
                    onClick={() => setShowPaymentDialog(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Enregistrer paiement
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Main content */}
          <div className="md:col-span-2 space-y-6">
            {/* Montants */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Euro className="h-5 w-5 text-blue-500" />
                  Détail des montants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Loyer</span>
                    <span className="font-medium">{invoice.montant_loyer.toLocaleString("fr-FR")} €</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Charges</span>
                    <span className="font-medium">{invoice.montant_charges.toLocaleString("fr-FR")} €</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center py-2">
                    <span className="font-semibold">Total</span>
                    <span className="font-bold text-lg">{invoice.montant_total.toLocaleString("fr-FR")} €</span>
                  </div>
                  {invoice.montant_paye && invoice.montant_paye > 0 && (
                    <>
                      <div className="flex justify-between items-center py-2 text-green-600">
                        <span>Déjà payé</span>
                        <span className="font-medium">-{invoice.montant_paye.toLocaleString("fr-FR")} €</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center py-2">
                        <span className="font-semibold text-amber-600">Reste à payer</span>
                        <span className="font-bold text-lg text-amber-600">{resteDu.toLocaleString("fr-FR")} €</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Paiements */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-500" />
                  Historique des paiements
                </CardTitle>
              </CardHeader>
              <CardContent>
                {invoice.payments && invoice.payments.length > 0 ? (
                  <div className="space-y-3">
                    {invoice.payments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{payment.montant.toLocaleString("fr-FR")} €</p>
                          <p className="text-sm text-muted-foreground">
                            {payment.moyen === "cb" && "Carte bancaire"}
                            {payment.moyen === "virement" && "Virement"}
                            {payment.moyen === "prelevement" && "Prélèvement"}
                            {payment.moyen === "especes" && "Espèces"}
                            {payment.moyen === "cheque" && "Chèque"}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            className={cn(
                              payment.statut === "succeeded" && "bg-green-100 text-green-700",
                              payment.statut === "pending" && "bg-amber-100 text-amber-700",
                              payment.statut === "failed" && "bg-red-100 text-red-700"
                            )}
                          >
                            {payment.statut === "succeeded" && "Réussi"}
                            {payment.statut === "pending" && "En attente"}
                            {payment.statut === "failed" && "Échoué"}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(payment.date_paiement), "dd/MM/yyyy", { locale: fr })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-4">
                    Aucun paiement enregistré
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Dates */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Émission</span>
                  <span>{format(new Date(invoice.date_emission), "dd/MM/yyyy", { locale: fr })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Échéance</span>
                  <span className={cn(
                    new Date(invoice.date_echeance) < new Date() && !isPaid && "text-red-600 font-medium"
                  )}>
                    {format(new Date(invoice.date_echeance), "dd/MM/yyyy", { locale: fr })}
                  </span>
                </div>
                {invoice.date_paiement && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paiement</span>
                    <span className="text-green-600">
                      {format(new Date(invoice.date_paiement), "dd/MM/yyyy", { locale: fr })}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Property */}
            {invoice.property && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-blue-500" />
                    Bien
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link
                    href={`/owner/properties/${invoice.property.id}`}
                    className="text-sm hover:text-blue-600 hover:underline"
                  >
                    {invoice.property.adresse_complete}
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Tenant */}
            {invoice.tenant && (
              <Card className="bg-white/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4 text-blue-500" />
                    Locataire
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="font-medium">
                    {invoice.tenant.prenom} {invoice.tenant.nom}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {invoice.tenant.email}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Dialog de paiement manuel */}
        <ManualPaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          invoiceId={invoice.id}
          invoiceReference={invoice.reference}
          amount={resteDu > 0 ? resteDu : invoice.montant_total}
          tenantName={invoice.tenant ? `${invoice.tenant.prenom} ${invoice.tenant.nom}` : "Locataire"}
          ownerName={invoice.owner ? `${invoice.owner.prenom} ${invoice.owner.nom}` : "Propriétaire"}
          propertyAddress={invoice.property?.adresse_complete || ""}
          periode={invoice.periode}
          onPaymentComplete={handlePaymentComplete}
        />
      </div>
    </motion.div>
  );
}

