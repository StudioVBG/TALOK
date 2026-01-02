"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  MapPin,
  Euro,
  User,
  Loader2,
  AlertCircle,
  CheckCircle,
  Shield,
} from "lucide-react";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";
import { formatCurrency } from "@/lib/helpers/format";

interface OwnerSignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSign: (signatureImage: string) => Promise<void>;
  leaseInfo: {
    id: string;
    typeBail: string;
    loyer: number;
    charges: number;
    propertyAddress: string;
    propertyCity: string;
    tenantName?: string;
    dateDebut: string;
  };
  ownerName: string;
}

const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
  mobilite: "Bail mobilité",
};

export function OwnerSignatureModal({
  isOpen,
  onClose,
  onSign,
  leaseInfo,
  ownerName,
}: OwnerSignatureModalProps) {
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [hasReadLease, setHasReadLease] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignatureComplete = async (signature: SignatureData) => {
    if (!hasAcceptedTerms || !hasReadLease) {
      setError("Veuillez cocher les deux cases avant de signer");
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      await onSign(signature.data);
      onClose();
    } catch (err: any) {
      setError(err.message || "Erreur lors de la signature");
    } finally {
      setIsSigning(false);
    }
  };

  const canSign = hasAcceptedTerms && hasReadLease && !isSigning;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Signer le bail en tant que propriétaire
          </DialogTitle>
          <DialogDescription>
            Vérifiez les informations puis signez électroniquement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Récapitulatif du bail */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Badge variant="secondary" className="text-xs">
                {LEASE_TYPE_LABELS[leaseInfo.typeBail] || leaseInfo.typeBail}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Début : {new Date(leaseInfo.dateDebut).toLocaleDateString("fr-FR")}
              </span>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm font-medium">{leaseInfo.propertyAddress}</p>
                <p className="text-xs text-muted-foreground">{leaseInfo.propertyCity}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-blue-600">
                  {formatCurrency(leaseInfo.loyer + leaseInfo.charges)}
                </span>
                <span className="text-xs text-muted-foreground">
                  /mois ({formatCurrency(leaseInfo.loyer)} + {formatCurrency(leaseInfo.charges)} charges)
                </span>
              </div>
            </div>

            {leaseInfo.tenantName && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">Locataire : <strong>{leaseInfo.tenantName}</strong></span>
              </div>
            )}
          </div>

          {/* Checkboxes de confirmation */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <Checkbox
                id="read-lease"
                checked={hasReadLease}
                onCheckedChange={(c) => setHasReadLease(c === true)}
              />
              <Label htmlFor="read-lease" className="text-sm cursor-pointer leading-relaxed">
                J'ai relu le contrat de bail dans son intégralité et je confirme l'exactitude des informations
              </Label>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <Checkbox
                id="accept-terms"
                checked={hasAcceptedTerms}
                onCheckedChange={(c) => setHasAcceptedTerms(c === true)}
              />
              <Label htmlFor="accept-terms" className="text-sm cursor-pointer leading-relaxed">
                J'accepte de signer électroniquement ce bail et je m'engage à respecter les obligations du bailleur
              </Label>
            </div>
          </div>

          {/* Erreur */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Zone de signature */}
          <div className={!canSign ? "opacity-50 pointer-events-none" : ""}>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">Votre signature</span>
            </div>
            
            <SignaturePad
              signerName={ownerName}
              onSignatureComplete={handleSignatureComplete}
              disabled={!canSign}
            />
          </div>

          {/* Indicateur de chargement */}
          {isSigning && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <span className="text-sm text-muted-foreground">Signature en cours...</span>
            </div>
          )}

          {/* Note légale */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800 dark:text-blue-200">
              Cette signature électronique simple (SES) a la même valeur juridique qu'une signature manuscrite 
              conformément à l'article 1367 du Code Civil et au règlement européen eIDAS.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSigning}>
            Annuler
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}






