"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Send, AlertTriangle } from "lucide-react";

interface ReversementModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  mandantName: string;
  balanceCents: number;
  iban: string | null;
  onReverse: (accountId: string, amountCents: number) => Promise<void>;
}

export function ReversementModal({
  open,
  onClose,
  accountId,
  mandantName,
  balanceCents,
  iban,
  onReverse,
}: ReversementModalProps) {
  const { toast } = useToast();
  const [amount, setAmount] = useState((balanceCents / 100).toFixed(2));
  const [isProcessing, setIsProcessing] = useState(false);

  const amountCents = Math.round(parseFloat(amount || "0") * 100);
  const isValid = amountCents > 0 && amountCents <= balanceCents && !!iban;

  const handleSubmit = async () => {
    if (!isValid) return;
    setIsProcessing(true);
    try {
      await onReverse(accountId, amountCents);
      toast({
        title: "Reversement effectue",
        description: `${(amountCents / 100).toFixed(2)} EUR reverse a ${mandantName}.`,
      });
      onClose();
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'effectuer le reversement.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reversement a {mandantName}</DialogTitle>
          <DialogDescription>
            Transferer des fonds du compte mandant vers le proprietaire
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!iban && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                IBAN non renseigne. Mettez a jour le mandat avant le reversement.
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg bg-muted text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Solde disponible</span>
              <span className="font-semibold">{(balanceCents / 100).toFixed(2)} EUR</span>
            </div>
            {iban && (
              <div className="flex justify-between mt-1">
                <span className="text-muted-foreground">IBAN</span>
                <span className="font-mono text-xs">{iban}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Montant a reverser (EUR)</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              max={(balanceCents / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {amountCents > balanceCents && (
              <p className="text-xs text-red-500">
                Le montant ne peut pas depasser le solde disponible.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isProcessing}
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {isProcessing ? "Traitement..." : "Reverser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
