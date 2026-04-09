"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

const CONFIRMATION_TEXT = "SUPPRIMER MON COMPTE";

export function DeleteAccountModal() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"info" | "confirm">("info");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const isConfirmed = confirmation === CONFIRMATION_TEXT;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      const res = await fetch("/api/rgpd/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: CONFIRMATION_TEXT }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      toast({
        title: "Compte supprime",
        description: "Votre compte a ete anonymise. Vous allez etre deconnecte.",
      });

      // Redirect to home after short delay
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    } catch (err: any) {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de supprimer le compte.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const reset = () => {
    setStep("info");
    setConfirmation("");
    setLoading(false);
  };

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400">
            <Trash2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base text-destructive">Supprimer mon compte</CardTitle>
            <CardDescription>
              Droit a l&apos;effacement (Article 17 RGPD) — Action irreversible
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>La suppression de votre compte entraine :</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>L&apos;anonymisation de vos donnees personnelles (nom, email, telephone)</li>
            <li>La suppression de vos photos et documents d&apos;identite</li>
            <li>La deconnexion de toutes vos sessions</li>
          </ul>
          <p className="text-xs">
            <strong>Conservation legale :</strong> Les factures et quittances sont conservees 10 ans
            (obligation comptable). Les documents de bail sont conserves 5 ans apres fin de bail.
          </p>
        </div>

        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) reset();
          }}
        >
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Supprimer mon compte
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Confirmer la suppression
              </DialogTitle>
              <DialogDescription>
                Cette action est irreversible. Toutes vos donnees personnelles seront anonymisees.
              </DialogDescription>
            </DialogHeader>

            {step === "info" ? (
              <div className="space-y-4">
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                  <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Avant de continuer, verifiez que :
                  </h4>
                  <ul className="mt-2 text-sm text-amber-700 dark:text-amber-300 space-y-1">
                    <li>• Vous n&apos;avez aucun bail actif en cours</li>
                    <li>• Vous n&apos;avez aucun paiement en attente</li>
                    <li>• Vous avez exporte vos donnees si necessaire</li>
                  </ul>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Annuler
                  </Button>
                  <Button variant="destructive" onClick={() => setStep("confirm")}>
                    Je comprends, continuer
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Tapez <strong className="text-foreground">{CONFIRMATION_TEXT}</strong> pour
                  confirmer :
                </p>
                <Input
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={CONFIRMATION_TEXT}
                  autoComplete="off"
                  autoFocus
                />
                <DialogFooter>
                  <Button variant="outline" onClick={() => setStep("info")} disabled={loading}>
                    Retour
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={!isConfirmed || loading}
                    className="gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Suppression...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Supprimer definitivement
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
