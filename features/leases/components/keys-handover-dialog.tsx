"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Key } from "lucide-react";
import { KeyHandoverQRGenerator } from "@/components/key-handover/KeyHandoverQRGenerator";
import { cn } from "@/lib/utils";

interface KeysHandoverDialogProps {
  leaseId: string;
  /** true si la remise a déjà été confirmée (désactive le bouton déclencheur) */
  alreadyConfirmed?: boolean;
  /** Classe CSS sur le bouton déclencheur */
  triggerClassName?: string;
}

/**
 * Dialog wrappant le flux complet de remise des clés.
 * Affiche un bouton "Remise des clés" qui ouvre une modale avec
 * le générateur de QR code.
 */
export function KeysHandoverDialog({
  leaseId,
  alreadyConfirmed = false,
  triggerClassName,
}: KeysHandoverDialogProps) {
  const [open, setOpen] = useState(false);

  if (alreadyConfirmed) {
    return (
      <Button
        variant="outline"
        disabled
        className={cn(
          "gap-2 border-emerald-200 bg-emerald-50 text-emerald-700 cursor-default dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
          triggerClassName
        )}
      >
        <Key className="h-4 w-4" />
        Clés remises
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 font-semibold dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-300 dark:hover:bg-indigo-900/40 dark:hover:border-indigo-800",
            triggerClassName
          )}
        >
          <Key className="h-4 w-4" />
          Remise des clés
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md w-full p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <div className="p-1.5 bg-indigo-100 rounded-lg dark:bg-indigo-900/40">
              <Key className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            Remise des clés
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Générez un QR code que le locataire scannera pour confirmer la réception des clés.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6">
          <KeyHandoverQRGenerator leaseId={leaseId} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
