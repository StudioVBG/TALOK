"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Phone,
  User,
  CheckCircle,
  XCircle,
  Clock,
  Camera,
  Euro,
  FileText,
  Send,
  Play,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";

interface JobDetailProps {
  job: any;
}

const STATUS_LABELS: Record<string, string> = {
  // EN modern
  draft: "Brouillon",
  quote_requested: "Devis demandé",
  quote_received: "Devis envoyé — en attente",
  quote_approved: "Devis accepté",
  quote_rejected: "Devis refusé",
  scheduled: "Planifié",
  in_progress: "En cours",
  completed: "Travaux terminés",
  invoiced: "Facturé",
  paid: "Payé",
  disputed: "Litige",
  cancelled: "Annulé",
  // FR legacy
  assigned: "En attente",
  done: "Terminé",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-foreground",
  quote_requested: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  quote_received: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  quote_approved: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300",
  quote_rejected: "bg-red-100 text-red-800 border-red-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  invoiced: "bg-cyan-100 text-cyan-800 border-cyan-200",
  paid: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  disputed: "bg-orange-100 text-orange-800 border-orange-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  assigned: "bg-yellow-100 text-yellow-800 border-yellow-200",
  done: "bg-green-100 text-green-800 border-green-200",
};

export function JobDetailClient({ job }: JobDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState<string | null>(null);

  const [quoteAmount, setQuoteAmount] = useState("");
  const [report, setReport] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  const status = job.status || job.statut || "draft";
  const isLegacy = !job.status && !!job.statut;

  const callApi = async (
    action: string,
    body?: Record<string, unknown>,
    successMessage?: string
  ) => {
    setLoading(action);
    try {
      const res = await fetch(`/api/work-orders/${job.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Erreur serveur");

      toast({
        title: successMessage || "Action effectuée",
        description: data.message || undefined,
      });
      router.refresh();
      return data;
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Action impossible",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(null);
    }
  };

  const handleAccept = () => callApi("accept", {}, "Mission acceptée");
  const handleReject = () => callApi("reject", {}, "Mission refusée");

  const handleSubmitQuote = async () => {
    const amount = parseFloat(quoteAmount);
    if (!amount || amount <= 0) {
      toast({
        title: "Montant invalide",
        description: "Renseignez un montant en euros supérieur à 0.",
        variant: "destructive",
      });
      return;
    }
    await callApi(
      "submit-quote",
      { quote_amount_cents: Math.round(amount * 100) },
      "Devis envoyé au propriétaire"
    );
    setQuoteAmount("");
  };

  const handleStart = () => callApi("start", {}, "Travaux démarrés");

  const handleComplete = async () => {
    if (!report.trim() || report.length < 10) {
      toast({
        title: "Rapport requis",
        description: "Le rapport d'intervention doit faire au moins 10 caractères.",
        variant: "destructive",
      });
      return;
    }
    await callApi(
      "complete",
      {
        intervention_report: report.trim(),
        intervention_photos: photoUrl
          ? [{ url: photoUrl.trim(), caption: "Après intervention" }]
          : [],
      },
      "Intervention clôturée"
    );
    setReport("");
    setPhotoUrl("");
  };

  const depositSecured =
    job.payments?.deposit?.escrow_status === "held" ||
    job.payments?.deposit?.escrow_status === "released";
  const balancePaid = !!job.payments?.balance;
  const showLegacyAccept = isLegacy && job.statut === "assigned";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button variant="ghost" asChild className="mb-4 pl-0 hover:bg-transparent hover:text-blue-600">
          <Link href="/provider/jobs" className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Retour aux missions
          </Link>
        </Button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-foreground">{job.title}</h1>
              <Badge className={STATUS_COLORS[status] || "bg-muted text-foreground"} variant="outline">
                {STATUS_LABELS[status] || status}
              </Badge>
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {job.property.address}, {job.property.postalCode} {job.property.city}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {/* État: quote_requested → soumettre un devis */}
            {status === "quote_requested" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading !== null}>
                    <Send className="mr-2 h-4 w-4" />
                    Soumettre un devis
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Soumettre votre devis</DialogTitle>
                    <CardDescription>
                      Le propriétaire recevra le montant et pourra l&apos;accepter ou le refuser.
                    </CardDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="quote-amount">Montant TTC (€)</Label>
                      <Input
                        id="quote-amount"
                        type="number"
                        min="0"
                        step="0.01"
                        value={quoteAmount}
                        onChange={(e) => setQuoteAmount(e.target.value)}
                        placeholder="350.00"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSubmitQuote} disabled={loading === "submit-quote"}>
                      {loading === "submit-quote" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Envoyer le devis"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* État: scheduled → démarrer (libère l'acompte si présent) */}
            {status === "scheduled" && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleStart}
                disabled={loading !== null}
              >
                {loading === "start" ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Démarrer les travaux
              </Button>
            )}

            {/* État: in_progress → terminer */}
            {status === "in_progress" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={loading !== null}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Terminer l&apos;intervention
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Rapport d&apos;intervention</DialogTitle>
                    <CardDescription>
                      Décrivez les travaux réalisés et joignez une photo. Le propriétaire dispose
                      ensuite de 7 jours pour valider avant libération automatique du solde.
                    </CardDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="report">Rapport d&apos;intervention</Label>
                      <Textarea
                        id="report"
                        rows={5}
                        value={report}
                        onChange={(e) => setReport(e.target.value)}
                        placeholder="Travaux réalisés, pièces remplacées, état final…"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="photo">URL d&apos;une photo (optionnel)</Label>
                      <Input
                        id="photo"
                        type="url"
                        value={photoUrl}
                        onChange={(e) => setPhotoUrl(e.target.value)}
                        placeholder="https://…"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={handleComplete} disabled={loading === "complete"}>
                      {loading === "complete" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Confirmer la clôture"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

            {/* Legacy : ancien WO en statut 'assigned' sans status EN */}
            {showLegacyAccept && (
              <>
                <Button
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={handleReject}
                  disabled={loading !== null}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Refuser
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleAccept}
                  disabled={loading !== null}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Accepter
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Banner escrow */}
      {status === "scheduled" && (
        <Alert
          className={
            depositSecured
              ? "mb-6 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20"
              : "mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20"
          }
        >
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription>
            {depositSecured
              ? "Acompte sécurisé sur Talok. Il sera libéré sur votre compte dès que vous démarrez les travaux."
              : "Le propriétaire n'a pas encore réglé l'acompte. Vous pouvez démarrer les travaux mais l'acompte ne sera libéré qu'après son paiement."}
          </AlertDescription>
        </Alert>
      )}
      {status === "completed" && (
        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            {balancePaid
              ? "Solde réglé. Libération automatique des fonds 7 jours après la clôture sauf validation explicite du propriétaire avant cette date."
              : "Le propriétaire doit régler le solde. Une relance lui a été envoyée."}
            {job.dispute_deadline && (
              <span className="ml-1 font-medium">
                Délai de contestation jusqu&apos;au{" "}
                {format(new Date(job.dispute_deadline), "d MMMM yyyy", { locale: fr })}.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Description du problème</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{job.description}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Détails financiers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/40 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                    <Euro className="h-3.5 w-3.5" /> Devis envoyé
                  </p>
                  <p className="text-xl font-semibold">
                    {job.quote_amount_cents
                      ? `${(job.quote_amount_cents / 100).toFixed(2)} €`
                      : job.estimated_cost
                        ? `${job.estimated_cost} €`
                        : "Non envoyé"}
                  </p>
                </div>
                <div
                  className={`p-4 rounded-lg ${
                    job.payments?.deposit?.escrow_status === "released"
                      ? "bg-emerald-50 dark:bg-emerald-950/20"
                      : "bg-muted/40"
                  }`}
                >
                  <p className="text-sm text-muted-foreground mb-1">Acompte (30%)</p>
                  <p className="text-xl font-semibold">
                    {job.payments?.deposit
                      ? `${job.payments.deposit.amount.toFixed(2)} €`
                      : "—"}
                  </p>
                  {job.payments?.deposit && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {job.payments.deposit.escrow_status === "released"
                        ? "Versé sur votre compte"
                        : "En escrow Talok"}
                    </p>
                  )}
                </div>
              </div>
              {job.payments?.balance && (
                <div className="mt-4 p-4 bg-muted/40 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Solde (70%)</p>
                  <p className="text-xl font-semibold">
                    {job.payments.balance.amount.toFixed(2)} €
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {job.payments.balance.escrow_status === "released"
                      ? "Versé sur votre compte"
                      : "En escrow Talok — libération sous 7 jours"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {job.intervention_report && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Rapport d&apos;intervention
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{job.intervention_report}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Propriétaire
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{job.owner.name}</p>
                    {job.owner.phone && (
                      <p className="text-xs text-muted-foreground">{job.owner.phone}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase mb-2">
                  Locataire (sur place)
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{job.tenant.name}</p>
                    {job.tenant.phone && (
                      <div className="flex items-center gap-1 mt-1">
                        <Phone className="h-3 w-3 text-muted-foreground/70" />
                        <a
                          href={`tel:${job.tenant.phone}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          {job.tenant.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Planning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Date prévue</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground/70" />
                  <span className="text-sm">
                    {job.scheduled_date
                      ? format(new Date(job.scheduled_date), "d MMMM yyyy", { locale: fr })
                      : "À définir"}
                  </span>
                </div>
              </div>

              {job.completed_at && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Réalisé le</p>
                  <div className="flex items-center gap-2 text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {format(new Date(job.completed_at), "d MMMM yyyy", { locale: fr })}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
