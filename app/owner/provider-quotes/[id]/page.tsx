"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Loader2,
  X,
} from "lucide-react";

type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "converted";

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit?: string | null;
  unit_price: number;
  tax_rate: number;
  sort_order?: number | null;
}

interface QuoteDetail {
  id: string;
  reference: string;
  title: string;
  description?: string | null;
  status: QuoteStatus;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  valid_until?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
  terms_and_conditions?: string | null;
  items: QuoteItem[];
  property_address?: string | null;
  owner_name?: string | null;
  acceptance_signed_name?: string | null;
  acceptance_signed_at?: string | null;
}

const statusLabels: Record<QuoteStatus, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-gray-100 text-gray-700" },
  sent: { label: "Reçu", className: "bg-blue-100 text-blue-700" },
  viewed: { label: "Vu", className: "bg-indigo-100 text-indigo-700" },
  accepted: { label: "Accepté", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusé", className: "bg-red-100 text-red-700" },
  expired: { label: "Expiré", className: "bg-amber-100 text-amber-700" },
  converted: { label: "Converti en facture", className: "bg-violet-100 text-violet-700" },
};

function formatEur(n: number | string | null | undefined): string {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);
}

function formatDateFr(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function OwnerProviderQuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const quoteId = params?.id as string;

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [signedName, setSignedName] = useState("");

  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/provider/quotes/${quoteId}`, {
          credentials: "include",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erreur de chargement");
        if (!cancelled) setQuote(json.quote);
      } catch (error) {
        if (!cancelled) {
          toast({
            title: "Erreur",
            description: error instanceof Error ? error.message : "Devis introuvable",
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quoteId, toast]);

  const handleAccept = async () => {
    if (!quote || accepting) return;
    if (signedName.trim().length < 2) {
      toast({
        title: "Signature requise",
        description: "Saisissez votre nom complet pour valider l'acceptation.",
        variant: "destructive",
      });
      return;
    }
    setAccepting(true);
    try {
      const res = await fetch(`/api/provider/quotes/${quote.id}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ signed_name: signedName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors de l'acceptation");
      toast({
        title: "Devis accepté",
        description: "Le prestataire a été notifié par email.",
      });
      // Refresh
      setQuote({
        ...quote,
        status: "accepted",
        accepted_at: json.accepted_at,
        acceptance_signed_name: signedName.trim(),
        acceptance_signed_at: json.accepted_at,
      });
      setSignedName("");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Action impossible",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleReject = async () => {
    if (!quote || rejecting) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/provider/quotes/${quote.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          rejectReason.trim() ? { reason: rejectReason.trim() } : {},
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Erreur lors du refus");
      toast({ title: "Devis refusé" });
      setQuote({
        ...quote,
        status: "rejected",
        rejected_at: json.rejected_at,
        rejection_reason: rejectReason.trim() || null,
      });
      setRejectReason("");
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Action impossible",
        variant: "destructive",
      });
    } finally {
      setRejecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground">Devis introuvable.</p>
            <Button onClick={() => router.push("/owner/dashboard")}>Retour</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusBadge = statusLabels[quote.status];
  const canAct = quote.status === "sent" || quote.status === "viewed";

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <Link
          href="/owner/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Retour
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Devis {quote.reference}
            </h1>
            <p className="text-muted-foreground">{quote.title}</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className={statusBadge.className}>
              {statusBadge.label}
            </Badge>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`/api/provider/quotes/${quote.id}/pdf?download=true`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="h-4 w-4 mr-2" />
                PDF
              </a>
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Détail du devis</CardTitle>
          {quote.property_address && (
            <CardDescription>{quote.property_address}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {quote.description && (
            <p className="text-sm text-muted-foreground">{quote.description}</p>
          )}

          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium text-right">Qté</th>
                  <th className="px-3 py-2 font-medium text-right">PU HT</th>
                  <th className="px-3 py-2 font-medium text-right">TVA</th>
                  <th className="px-3 py-2 font-medium text-right">Total HT</th>
                </tr>
              </thead>
              <tbody>
                {[...(quote.items || [])]
                  .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                  .map((it) => {
                    const qty = Number(it.quantity) || 0;
                    const pu = Number(it.unit_price) || 0;
                    return (
                      <tr key={it.id} className="border-t">
                        <td className="px-3 py-2">{it.description}</td>
                        <td className="px-3 py-2 text-right">
                          {qty}
                          {it.unit ? ` ${it.unit}` : ""}
                        </td>
                        <td className="px-3 py-2 text-right">{formatEur(pu)}</td>
                        <td className="px-3 py-2 text-right">{it.tax_rate}%</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatEur(qty * pu)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-xs space-y-1 pt-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span>{formatEur(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TVA</span>
              <span>{formatEur(quote.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-base font-bold pt-1 border-t">
              <span>Total TTC</span>
              <span className="text-orange-600">
                {formatEur(quote.total_amount)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t text-sm">
            <div>
              <p className="text-muted-foreground">Reçu le</p>
              <p className="font-medium">{formatDateFr(quote.sent_at)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Validité</p>
              <p className="font-medium">{formatDateFr(quote.valid_until)}</p>
            </div>
            {quote.accepted_at && (
              <div>
                <p className="text-muted-foreground">Accepté le</p>
                <p className="font-medium text-emerald-600">
                  {formatDateFr(quote.accepted_at)}
                </p>
              </div>
            )}
            {quote.rejected_at && (
              <div>
                <p className="text-muted-foreground">Refusé le</p>
                <p className="font-medium text-red-600">
                  {formatDateFr(quote.rejected_at)}
                </p>
              </div>
            )}
          </div>

          {quote.terms_and_conditions && (
            <div className="pt-3 border-t">
              <p className="text-sm font-medium mb-1">Conditions</p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {quote.terms_and_conditions}
              </p>
            </div>
          )}

          {quote.rejection_reason && (
            <div className="pt-3 border-t bg-red-50 -mx-6 px-6 py-3 text-sm">
              <p className="font-medium text-red-900 mb-1">Motif de refus</p>
              <p className="text-red-700">{quote.rejection_reason}</p>
            </div>
          )}

          {quote.acceptance_signed_name && (
            <div className="pt-3 border-t bg-emerald-50 -mx-6 px-6 py-3 text-sm">
              <p className="font-medium text-emerald-900 mb-1">Signature d'acceptation</p>
              <p className="text-emerald-800">
                Signé par <strong>{quote.acceptance_signed_name}</strong>
                {quote.acceptance_signed_at
                  ? ` le ${formatDateFr(quote.acceptance_signed_at)}`
                  : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {canAct && (
        <Card>
          <CardHeader>
            <CardTitle>Votre décision</CardTitle>
            <CardDescription>
              L'acceptation engage votre responsabilité et notifiera le prestataire par email. Le refus est définitif.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={accepting || rejecting}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Accepter le devis
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmer l'acceptation</AlertDialogTitle>
                  <AlertDialogDescription>
                    En signant ci-dessous, vous acceptez le devis pour un montant de{" "}
                    <strong>{formatEur(quote.total_amount)}</strong>. Cette acceptation
                    a valeur d'engagement contractuel envers le prestataire.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-3 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="signed-name">Votre nom complet *</Label>
                    <Input
                      id="signed-name"
                      value={signedName}
                      onChange={(e) => setSignedName(e.target.value)}
                      placeholder="Prénom NOM"
                      maxLength={120}
                      autoComplete="name"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Votre nom, l'horodatage, votre IP et votre navigateur seront
                    enregistrés à titre de preuve d'acceptation.
                  </p>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={accepting}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleAccept}
                    disabled={accepting || signedName.trim().length < 2}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {accepting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Signer et accepter
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={accepting || rejecting}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Refuser
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Refuser ce devis ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le prestataire pourra voir votre refus. Vous pouvez ajouter un motif (optionnel).
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="reason">Motif (optionnel)</Label>
                  <Textarea
                    id="reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ex : montant trop élevé, délai trop long..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={rejecting}>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleReject}
                    disabled={rejecting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {rejecting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : null}
                    Confirmer le refus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
