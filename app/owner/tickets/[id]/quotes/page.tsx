// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  FileText,
  Euro,
  Calendar,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Star,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/components/ui/use-toast";

interface Quote {
  id: string;
  ticket_id: string;
  provider_id: string;
  amount: number;
  description: string;
  valid_until: string | null;
  status: "pending" | "accepted" | "rejected" | "expired";
  created_at: string;
  provider?: {
    prenom: string;
    nom: string;
  };
}

interface Ticket {
  id: string;
  titre: string;
  description: string;
  priorite: string;
  statut: string;
  property?: {
    adresse_complete: string;
    ville: string;
  };
}

const statusConfig = {
  pending: {
    label: "En attente",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    icon: Clock,
  },
  accepted: {
    label: "Accepté",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Refusé",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
    icon: XCircle,
  },
  expired: {
    label: "Expiré",
    color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
    icon: AlertTriangle,
  },
};

export default function QuotesComparisonPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const { toast } = useToast();

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    quoteId: string;
    action: "accept" | "reject";
  }>({ open: false, quoteId: "", action: "accept" });

  useEffect(() => {
    fetchData();
  }, [ticketId]);

  async function fetchData() {
    try {
      setLoading(true);

      // Récupérer le ticket
      const ticketRes = await fetch(`/api/tickets/${ticketId}`);
      if (!ticketRes.ok) throw new Error("Ticket non trouvé");
      const ticketData = await ticketRes.json();
      setTicket(ticketData.ticket);

      // Récupérer les devis
      const quotesRes = await fetch(`/api/tickets/${ticketId}/quotes`);
      if (!quotesRes.ok) throw new Error("Erreur lors du chargement des devis");
      const quotesData = await quotesRes.json();
      
      // Vérifier les devis expirés
      const updatedQuotes = (quotesData.quotes || []).map((q: Quote) => {
        if (q.status === "pending" && q.valid_until && isPast(new Date(q.valid_until))) {
          return { ...q, status: "expired" as const };
        }
        return q;
      });
      
      setQuotes(updatedQuotes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuoteAction(quoteId: string, action: "accept" | "reject") {
    setActionLoading(quoteId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/${action}`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Erreur lors de ${action === "accept" ? "l'acceptation" : "le refus"}`);
      }

      toast({
        title: action === "accept" ? "✅ Devis accepté" : "❌ Devis refusé",
        description: action === "accept" 
          ? "Le prestataire sera notifié et pourra planifier l'intervention."
          : "Le prestataire sera notifié du refus.",
      });

      fetchData();
      setConfirmDialog({ open: false, quoteId: "", action: "accept" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: err instanceof Error ? err.message : "Erreur inconnue",
      });
    } finally {
      setActionLoading(null);
    }
  }

  // Calculs pour la comparaison
  const pendingQuotes = quotes.filter((q) => q.status === "pending");
  const lowestQuote = pendingQuotes.length > 0 
    ? pendingQuotes.reduce((min, q) => q.amount < min.amount ? q : min, pendingQuotes[0])
    : null;
  const highestQuote = pendingQuotes.length > 0
    ? pendingQuotes.reduce((max, q) => q.amount > max.amount ? q : max, pendingQuotes[0])
    : null;
  const averageAmount = pendingQuotes.length > 0
    ? pendingQuotes.reduce((sum, q) => sum + q.amount, 0) / pendingQuotes.length
    : 0;
  const acceptedQuote = quotes.find((q) => q.status === "accepted");

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => router.back()}>Retour</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/owner/tickets/${ticketId}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Comparaison des devis</h1>
            <p className="text-muted-foreground">
              {ticket?.titre} - {ticket?.property?.ville}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{quotes.length}</p>
                <p className="text-sm text-muted-foreground">Devis reçus</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <TrendingDown className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {lowestQuote ? `${lowestQuote.amount.toFixed(2)}€` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Moins cher</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                <Euro className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {averageAmount > 0 ? `${averageAmount.toFixed(2)}€` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Moyenne</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {highestQuote ? `${highestQuote.amount.toFixed(2)}€` : "—"}
                </p>
                <p className="text-sm text-muted-foreground">Plus cher</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devis accepté */}
      {acceptedQuote && (
        <Card className="border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-emerald-900 dark:text-emerald-100">Devis accepté</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">
                  {acceptedQuote.provider?.prenom} {acceptedQuote.provider?.nom}
                </p>
                <p className="text-sm text-muted-foreground">{acceptedQuote.description}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600">
                  {acceptedQuote.amount.toFixed(2)}€
                </p>
                <p className="text-sm text-muted-foreground">
                  Accepté {formatDistanceToNow(new Date(acceptedQuote.created_at), { addSuffix: true, locale: fr })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau comparatif */}
      <Card>
        <CardHeader>
          <CardTitle>Tous les devis</CardTitle>
          <CardDescription>
            Comparez les offres des prestataires et choisissez celle qui vous convient
          </CardDescription>
        </CardHeader>
        <CardContent>
          {quotes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">Aucun devis</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Les prestataires assignés n'ont pas encore soumis de devis.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Prestataire</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Validité</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => {
                  const status = statusConfig[quote.status];
                  const StatusIcon = status.icon;
                  const isLowest = lowestQuote?.id === quote.id;
                  const isExpired = quote.valid_until && isPast(new Date(quote.valid_until));

                  return (
                    <TableRow key={quote.id} className={isLowest && quote.status === "pending" ? "bg-emerald-50/50 dark:bg-emerald-950/20" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">
                              {quote.provider?.prenom} {quote.provider?.nom}
                            </p>
                            {isLowest && quote.status === "pending" && (
                              <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                                <Star className="h-3 w-3 mr-1" />
                                Meilleur prix
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm line-clamp-2">{quote.description}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`text-lg font-bold ${isLowest && quote.status === "pending" ? "text-emerald-600" : ""}`}>
                          {quote.amount.toFixed(2)}€
                        </span>
                      </TableCell>
                      <TableCell>
                        {quote.valid_until ? (
                          <div className={`flex items-center gap-1 text-sm ${isExpired ? "text-red-600" : "text-muted-foreground"}`}>
                            <Calendar className="h-3 w-3" />
                            {format(new Date(quote.valid_until), "dd MMM yyyy", { locale: fr })}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {quote.status === "pending" && !isExpired && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={() => setConfirmDialog({ open: true, quoteId: quote.id, action: "reject" })}
                              disabled={!!actionLoading}
                            >
                              {actionLoading === quote.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ThumbsDown className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700"
                              onClick={() => setConfirmDialog({ open: true, quoteId: quote.id, action: "accept" })}
                              disabled={!!actionLoading}
                            >
                              {actionLoading === quote.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <ThumbsUp className="h-4 w-4 mr-1" />
                                  Accepter
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmation */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "accept" ? "Accepter ce devis ?" : "Refuser ce devis ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "accept"
                ? "En acceptant ce devis, le prestataire sera notifié et pourra planifier l'intervention. Les autres devis seront automatiquement refusés."
                : "Le prestataire sera notifié du refus. Vous pourrez toujours accepter un autre devis."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className={confirmDialog.action === "accept" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
              onClick={() => handleQuoteAction(confirmDialog.quoteId, confirmDialog.action)}
            >
              {confirmDialog.action === "accept" ? "Accepter" : "Refuser"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

