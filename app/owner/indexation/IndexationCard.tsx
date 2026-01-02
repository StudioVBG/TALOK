"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
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
  TrendingUp,
  Home,
  Calendar,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/lib/helpers/format";

interface IndexationCardProps {
  indexation: any;
  showActions?: boolean;
}

export function IndexationCard({ indexation, showActions = false }: IndexationCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isApplying, setIsApplying] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  const lease = indexation.lease;
  const property = lease?.property;

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const response = await fetch(`/api/indexations/${indexation.id}/apply`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'application");
      }

      toast({
        title: "Révision appliquée",
        description: "Le loyer a été mis à jour avec succès",
      });

      router.refresh();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };

  const handleDecline = async () => {
    setIsDeclining(true);
    try {
      const response = await fetch(`/api/indexations/${indexation.id}/decline`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur");
      }

      toast({
        title: "Révision refusée",
        description: "La révision n'a pas été appliquée",
      });

      router.refresh();
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsDeclining(false);
    }
  };

  const getStatusBadge = () => {
    switch (indexation.status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">En attente</Badge>;
      case "applied":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Appliquée</Badge>;
      case "declined":
        return <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200">Refusée</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className={indexation.status === "pending" ? "border-amber-200 bg-amber-50/30" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Révision IRL
                {getStatusBadge()}
              </CardTitle>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Home className="h-3.5 w-3.5" />
                {property?.adresse_complete || "Adresse inconnue"}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Détail de la révision */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Ancien loyer</p>
            <p className="font-semibold">{formatCurrency(indexation.old_rent)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Nouveau loyer</p>
            <p className="font-semibold text-green-600">{formatCurrency(indexation.new_rent)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Augmentation</p>
            <p className="font-semibold flex items-center gap-1">
              +{formatCurrency(indexation.increase_amount)}
              <span className="text-xs text-muted-foreground">
                (+{indexation.increase_percent}%)
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Date d'effet</p>
            <p className="font-medium flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(indexation.effective_date).toLocaleDateString("fr-FR")}
            </p>
          </div>
        </div>

        {/* Détail IRL */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-400" />
            <span className="text-muted-foreground">IRL :</span>
            <span className="font-medium">{indexation.old_irl_quarter}</span>
            <span className="text-muted-foreground">({indexation.old_irl_value})</span>
            <ArrowRight className="h-4 w-4 text-slate-400" />
            <span className="font-medium">{indexation.new_irl_quarter}</span>
            <span className="text-muted-foreground">({indexation.new_irl_value})</span>
          </div>
        </div>

        {/* Actions */}
        {showActions && indexation.status === "pending" && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={handleApply}
              disabled={isApplying || isDeclining}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Appliquer la révision
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  disabled={isApplying || isDeclining}
                >
                  {isDeclining ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Refuser
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Refuser cette révision ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le loyer ne sera pas augmenté cette année. Vous pourrez 
                    demander une nouvelle révision l'année prochaine.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDecline}>
                    Confirmer le refus
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Date d'application */}
        {indexation.status === "applied" && indexation.applied_at && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            Appliquée le {new Date(indexation.applied_at).toLocaleDateString("fr-FR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

