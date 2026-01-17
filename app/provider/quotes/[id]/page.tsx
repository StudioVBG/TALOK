"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
import {
  ArrowLeft,
  FileText,
  Euro,
  Calendar,
  Building2,
  User,
  Send,
  Trash2,
  Edit,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Loader2,
  Copy,
  Receipt,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { PageTransition } from "@/components/ui/page-transition";

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  tax_rate: number;
  subtotal: number;
}

interface Quote {
  id: string;
  reference: string;
  title: string;
  description?: string;
  owner_name?: string;
  property_address?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "converted";
  created_at: string;
  valid_until: string;
  sent_at?: string;
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;
  terms_and_conditions?: string;
  items: QuoteItem[];
  owner?: {
    id: string;
    prenom: string;
    nom: string;
    telephone?: string;
  };
  property?: {
    id: string;
    adresse_complete: string;
    ville: string;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Brouillon", color: "bg-slate-100 text-slate-700", icon: FileText },
  sent: { label: "Envoyé", color: "bg-blue-100 text-blue-700", icon: Send },
  viewed: { label: "Consulté", color: "bg-purple-100 text-purple-700", icon: Eye },
  accepted: { label: "Accepté", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-700", icon: XCircle },
  expired: { label: "Expiré", color: "bg-amber-100 text-amber-700", icon: Clock },
  converted: { label: "Converti", color: "bg-emerald-100 text-emerald-700", icon: Receipt },
};

export default function QuoteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const quoteId = params.id as string;

  useEffect(() => {
    fetchQuote();
  }, [quoteId]);

  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/provider/quotes/${quoteId}`);
      
      if (!response.ok) {
        throw new Error("Devis non trouvé");
      }
      
      const data = await response.json();
      setQuote(data.quote);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger le devis",
        variant: "destructive",
      });
      router.push("/provider/quotes");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/provider/quotes/${quoteId}/send`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi");
      }

      toast({
        title: "Devis envoyé",
        description: "Le client a été notifié.",
      });

      fetchQuote();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/provider/quotes/${quoteId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la suppression");
      }

      toast({
        title: "Devis supprimé",
        description: "Le devis a été supprimé.",
      });

      router.push("/provider/quotes");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
      setDeleting(false);
    }
  };

  const copyReference = () => {
    if (quote) {
      navigator.clipboard.writeText(quote.reference);
      toast({
        title: "Copié",
        description: "Référence copiée dans le presse-papier",
      });
    }
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </PageTransition>
    );
  }

  if (!quote) {
    return null;
  }

  const status = statusConfig[quote.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const isExpired = new Date(quote.valid_until) < new Date();
  const canEdit = quote.status === "draft";
  const canSend = quote.status === "draft";
  const canDelete = quote.status === "draft";

  return (
    <PageTransition>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-6 space-y-6 max-w-4xl mx-auto"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Link
              href="/provider/quotes"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux devis
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                Devis {quote.reference}
              </h1>
              <Button variant="ghost" size="icon" onClick={copyReference}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-muted-foreground">{quote.title}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {canSend && (
              <Button onClick={handleSend} disabled={sending}>
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Envoyer
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" asChild>
                <Link href={`/provider/quotes/${quoteId}/edit`}>
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </Link>
              </Button>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Supprimer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer ce devis ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le devis sera définitivement supprimé.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : null}
                      Supprimer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Status and dates */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4">
              <Badge className={cn(status.color, "flex items-center gap-1 text-sm px-3 py-1")}>
                <StatusIcon className="h-4 w-4" />
                {status.label}
              </Badge>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Créé le {format(new Date(quote.created_at), "dd MMMM yyyy", { locale: fr })}
              </div>

              <div className={cn(
                "flex items-center gap-2 text-sm",
                isExpired && quote.status !== "accepted" ? "text-red-600" : "text-muted-foreground"
              )}>
                <Clock className="h-4 w-4" />
                {isExpired && quote.status !== "accepted"
                  ? "Expiré"
                  : `Valide jusqu'au ${format(new Date(quote.valid_until), "dd MMMM yyyy", { locale: fr })}`
                }
              </div>

              {quote.sent_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Send className="h-4 w-4" />
                  Envoyé le {format(new Date(quote.sent_at), "dd/MM/yyyy à HH:mm", { locale: fr })}
                </div>
              )}
            </div>

            {quote.rejection_reason && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm text-red-700">
                  <strong>Motif du refus :</strong> {quote.rejection_reason}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-5 w-5 text-orange-500" />
                Client
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quote.owner_name ? (
                <div className="space-y-2">
                  <p className="font-medium">{quote.owner_name}</p>
                  {quote.owner?.telephone && (
                    <p className="text-sm text-muted-foreground">
                      Tél: {quote.owner.telephone}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Non renseigné</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-5 w-5 text-orange-500" />
                Adresse d'intervention
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quote.property_address ? (
                <p>{quote.property_address}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Non renseignée</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quote lines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-orange-500" />
              Détail du devis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left py-3 font-medium">Description</th>
                    <th className="text-center py-3 font-medium w-24">Qté</th>
                    <th className="text-right py-3 font-medium w-32">Prix unit.</th>
                    <th className="text-right py-3 font-medium w-32">Total HT</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items?.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3">{item.description}</td>
                      <td className="py-3 text-center">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="py-3 text-right">
                        {item.unit_price.toLocaleString("fr-FR")} €
                      </td>
                      <td className="py-3 text-right font-medium">
                        {item.subtotal.toLocaleString("fr-FR")} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            <div className="flex flex-col items-end gap-2">
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-muted-foreground">Sous-total HT</span>
                <span>{quote.subtotal?.toLocaleString("fr-FR")} €</span>
              </div>
              <div className="flex justify-between w-full max-w-xs text-sm">
                <span className="text-muted-foreground">TVA ({quote.tax_rate}%)</span>
                <span>{quote.tax_amount?.toLocaleString("fr-FR")} €</span>
              </div>
              <Separator className="w-full max-w-xs" />
              <div className="flex justify-between w-full max-w-xs text-lg font-bold">
                <span>Total TTC</span>
                <span className="text-orange-600">
                  {quote.total_amount?.toLocaleString("fr-FR")} €
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Description and terms */}
        {(quote.description || quote.terms_and_conditions) && (
          <Card>
            <CardHeader>
              <CardTitle>Notes et conditions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {quote.description && (
                <div>
                  <h4 className="font-medium mb-1">Description</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {quote.description}
                  </p>
                </div>
              )}
              {quote.terms_and_conditions && (
                <div>
                  <h4 className="font-medium mb-1">Conditions</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {quote.terms_and_conditions}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Quick actions */}
        {quote.status === "accepted" && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-medium text-green-900">Devis accepté</p>
                    <p className="text-sm text-green-700">
                      Accepté le {quote.accepted_at && format(new Date(quote.accepted_at), "dd/MM/yyyy", { locale: fr })}
                    </p>
                  </div>
                </div>
                <Button asChild>
                  <Link href={`/provider/invoices?from_quote=${quoteId}`}>
                    <Receipt className="h-4 w-4 mr-2" />
                    Créer la facture
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </PageTransition>
  );
}
