"use client";

/**
 * ManualPaymentDialog - Dialogue unifié pour enregistrer tous les types de paiements manuels
 * Espèces, Chèque, Virement avec flux différenciés
 */

import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  Banknote,
  Camera,
  CreditCard,
  Building2,
  Check,
  Loader2,
  Calendar,
  Hash,
  FileText,
  ChevronRight,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CashReceiptFlow } from "./CashReceiptFlow";

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_PHOTO_MIME = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

// Types
export interface ManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  invoiceReference: string;
  amount: number;
  tenantName: string;
  ownerName: string;
  propertyAddress: string;
  periode: string;
  onPaymentComplete?: () => void;
}

type PaymentMethod = "especes" | "cheque" | "virement";

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const PAYMENT_METHODS: PaymentMethodOption[] = [
  {
    id: "especes",
    label: "Espèces",
    description: "Paiement en main propre avec double signature",
    icon: <Banknote className="w-6 h-6" />,
    color: "text-green-600 dark:text-green-400",
    bgColor:
      "bg-green-50 border-green-200 hover:bg-green-100 dark:bg-green-950/30 dark:border-green-900 dark:hover:bg-green-900/40",
  },
  {
    id: "cheque",
    label: "Chèque",
    description: "Enregistrer un paiement par chèque reçu",
    icon: <FileText className="w-6 h-6" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor:
      "bg-blue-50 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:border-blue-900 dark:hover:bg-blue-900/40",
  },
  {
    id: "virement",
    label: "Virement bancaire",
    description: "Enregistrer un virement reçu",
    icon: <Building2 className="w-6 h-6" />,
    color: "text-purple-600 dark:text-purple-400",
    bgColor:
      "bg-purple-50 border-purple-200 hover:bg-purple-100 dark:bg-purple-950/30 dark:border-purple-900 dark:hover:bg-purple-900/40",
  },
];

export function ManualPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  invoiceReference,
  amount,
  tenantName,
  ownerName,
  propertyAddress,
  periode,
  onPaymentComplete,
}: ManualPaymentDialogProps) {
  const { toast } = useToast();
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"select" | "form" | "cash-flow">("select");

  // Form state for cheque/virement
  const [formData, setFormData] = useState({
    amount: amount.toString(),
    date: format(new Date(), "yyyy-MM-dd"),
    reference: "",
    bankName: "",
    notes: "",
  });

  // Photo du chèque (optionnelle). `chequePhotoFile` est conservé localement
  // et envoyé au serveur *avant* l'appel mark-paid. `chequePhotoPreview` est
  // un `URL.createObjectURL` révoqué au reset / cleanup.
  const [chequePhotoFile, setChequePhotoFile] = useState<File | null>(null);
  const [chequePhotoPreview, setChequePhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const chequePhotoInputRef = useRef<HTMLInputElement | null>(null);

  const clearChequePhoto = () => {
    if (chequePhotoPreview) URL.revokeObjectURL(chequePhotoPreview);
    setChequePhotoFile(null);
    setChequePhotoPreview(null);
    setPhotoError(null);
    if (chequePhotoInputRef.current) {
      chequePhotoInputRef.current.value = "";
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      clearChequePhoto();
      return;
    }

    setPhotoError(null);

    if (!ALLOWED_PHOTO_MIME.includes(file.type)) {
      setPhotoError(
        `Format non supporté (${file.type || "inconnu"}). Utilisez JPG, PNG, WebP ou HEIC.`
      );
      e.target.value = "";
      return;
    }

    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoError(
        `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : 5 Mo.`
      );
      e.target.value = "";
      return;
    }

    if (chequePhotoPreview) URL.revokeObjectURL(chequePhotoPreview);
    setChequePhotoFile(file);
    // `createObjectURL` ne sait pas afficher HEIC sur desktop — le preview
    // restera vide mais l'upload fonctionnera. C'est acceptable : sur iOS
    // le navigateur convertit souvent HEIC en JPEG à la capture.
    setChequePhotoPreview(URL.createObjectURL(file));
  };

  // Reset state when dialog closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedMethod(null);
      setStep("select");
      setFormData({
        amount: amount.toString(),
        date: format(new Date(), "yyyy-MM-dd"),
        reference: "",
        bankName: "",
        notes: "",
      });
      clearChequePhoto();
    }
    onOpenChange(open);
  };

  // Select payment method
  const handleSelectMethod = (method: PaymentMethod) => {
    setSelectedMethod(method);
    if (method === "especes") {
      setStep("cash-flow");
    } else {
      setStep("form");
    }
  };

  // Go back to selection
  const handleBack = () => {
    setSelectedMethod(null);
    setStep("select");
  };

  // Submit manual payment (cheque/virement)
  const handleSubmitManualPayment = async () => {
    if (!selectedMethod) return;

    setLoading(true);
    try {
      // Étape préliminaire : si une photo de chèque a été fournie, on
      // l'uploade AVANT d'enregistrer le paiement. L'échec d'upload ne
      // doit JAMAIS bloquer l'enregistrement du paiement — la photo est
      // strictement optionnelle. On logge l'erreur, on affiche un toast
      // warning et on continue avec `cheque_photo_path = undefined`.
      let chequePhotoPath: string | undefined;
      if (selectedMethod === "cheque" && chequePhotoFile) {
        try {
          const photoForm = new FormData();
          photoForm.append("file", chequePhotoFile);
          photoForm.append("invoice_id", invoiceId);

          const photoResponse = await fetch("/api/payments/cheque-photo", {
            method: "POST",
            body: photoForm,
          });

          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            chequePhotoPath = photoData.storage_path;
          } else {
            const photoBody = await photoResponse.json().catch(() => ({}));
            console.error(
              "[ManualPaymentDialog] Échec upload photo chèque (non bloquant):",
              photoBody
            );
            toast({
              title: "Photo non envoyée",
              description:
                "La photo du chèque n'a pas pu être enregistrée, mais le paiement va quand même être validé.",
              variant: "default",
            });
          }
        } catch (photoErr) {
          console.error(
            "[ManualPaymentDialog] Exception upload photo chèque (non bloquant):",
            photoErr
          );
        }
      }

      const response = await fetch(`/api/invoices/${invoiceId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          moyen: selectedMethod,
          date_paiement: formData.date,
          reference: formData.reference || undefined,
          bank_name: formData.bankName || undefined,
          notes: formData.notes || undefined,
          cheque_photo_path: chequePhotoPath,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'enregistrement");
      }

      toast({
        title: "✅ Paiement enregistré",
        description: `Le paiement par ${selectedMethod === "cheque" ? "chèque" : "virement"} a été enregistré.`,
      });

      onPaymentComplete?.();
      handleOpenChange(false);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Cash receipt completion handler
  const handleCashReceiptComplete = () => {
    onPaymentComplete?.();
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Mobile-first : pleine largeur sur 320px, max-h avec scroll interne
          pour garantir que les boutons restent visibles même si le contenu
          dépasse le viewport (bug : modal dépassait l'écran, boutons coupés). */}
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-lg md:max-w-xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Enregistrer un paiement manuel</DialogTitle>
        <AnimatePresence mode="wait">
          {/* Step 1: Method Selection */}
          {step === "select" && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" />
                  Enregistrer un paiement manuel
                </DialogTitle>
                <DialogDescription>
                  Facture {invoiceReference} • {amount.toLocaleString("fr-FR")} €
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-3">
                {PAYMENT_METHODS.map((method) => (
                  <motion.button
                    key={method.id}
                    onClick={() => handleSelectMethod(method.id)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                      method.bgColor
                    )}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    <div
                      className={cn(
                        "p-2 rounded-lg bg-white dark:bg-slate-900/70 shadow-sm",
                        method.color
                      )}
                    >
                      {method.icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-foreground">{method.label}</p>
                      <p className="text-sm text-muted-foreground">{method.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </motion.button>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                <p className="text-xs text-muted-foreground text-center">
                  Pour les paiements par carte bancaire, le locataire doit payer depuis son espace.
                </p>
              </div>
            </motion.div>
          )}

          {/* Step 2: Manual Form (Cheque/Virement) */}
          {step === "form" && selectedMethod && (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedMethod === "cheque" ? (
                    <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  )}
                  Enregistrer un {selectedMethod === "cheque" ? "chèque" : "virement"}
                </DialogTitle>
                <DialogDescription>
                  Facture {invoiceReference} • Locataire : {tenantName}
                </DialogDescription>
              </DialogHeader>

              <div className="mt-6 space-y-4">
                {/* Montant */}
                <div className="space-y-2">
                  <Label htmlFor="amount" className="flex items-center gap-2">
                    <Banknote className="w-4 h-4" />
                    Montant reçu
                  </Label>
                  <div className="relative">
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                      className="pr-8 text-lg font-semibold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      €
                    </span>
                  </div>
                  {parseFloat(formData.amount) !== amount && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      ⚠️ Montant différent de la facture ({amount.toLocaleString("fr-FR")} €)
                    </p>
                  )}
                </div>

                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Date de réception
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                {/* Reference (cheque number / virement ref) */}
                <div className="space-y-2">
                  <Label htmlFor="reference" className="flex items-center gap-2">
                    <Hash className="w-4 h-4" />
                    {selectedMethod === "cheque" ? "Numéro de chèque" : "Référence virement"}
                  </Label>
                  <Input
                    id="reference"
                    placeholder={selectedMethod === "cheque" ? "Ex: 0012345" : "Ex: VIR-2026-001"}
                    value={formData.reference}
                    onChange={(e) => setFormData((prev) => ({ ...prev, reference: e.target.value }))}
                  />
                </div>

                {/* Bank name */}
                <div className="space-y-2">
                  <Label htmlFor="bankName" className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Banque {selectedMethod === "cheque" ? "émettrice" : "d'origine"}
                  </Label>
                  <Input
                    id="bankName"
                    placeholder="Ex: Crédit Agricole, BNP..."
                    value={formData.bankName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, bankName: e.target.value }))}
                  />
                </div>

                {/* Photo du chèque — uniquement pour le mode "cheque".
                    `capture="environment"` déclenche la caméra arrière sur
                    mobile ; sur desktop le navigateur tombe sur l'explorateur
                    de fichiers classique. */}
                {selectedMethod === "cheque" && (
                  <div className="space-y-2">
                    <Label htmlFor="chequePhoto" className="flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Photo du chèque{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        (facultatif)
                      </span>
                    </Label>

                    {!chequePhotoPreview ? (
                      <>
                        <Input
                          ref={chequePhotoInputRef}
                          id="chequePhoto"
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          className="cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                        />
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG, WebP ou HEIC — 5 Mo max
                        </p>
                      </>
                    ) : (
                      <div className="relative inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={chequePhotoPreview}
                          alt="Aperçu du chèque"
                          className="max-h-48 w-auto rounded-lg border border-border/60 shadow-sm object-contain bg-muted"
                        />
                        <button
                          type="button"
                          onClick={clearChequePhoto}
                          className="absolute -top-2 -right-2 rounded-full bg-red-600 p-1.5 text-white shadow-md hover:bg-red-700 transition-colors"
                          aria-label="Supprimer la photo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {chequePhotoFile && (
                          <p className="text-xs text-muted-foreground mt-1.5 truncate max-w-[12rem]">
                            {chequePhotoFile.name} •{" "}
                            {(chequePhotoFile.size / 1024).toFixed(0)} Ko
                          </p>
                        )}
                      </div>
                    )}

                    {photoError && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        {photoError}
                      </p>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (optionnel)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Informations complémentaires..."
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <Button variant="outline" onClick={handleBack} className="flex-1">
                  Retour
                </Button>
                <Button
                  onClick={handleSubmitManualPayment}
                  disabled={loading || !formData.amount || parseFloat(formData.amount) <= 0}
                  className="flex-1 gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Enregistrer le paiement
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Cash Receipt Flow */}
          {step === "cash-flow" && (
            <motion.div
              key="cash-flow"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative -mx-4 -my-4 sm:-mx-6 sm:-my-6"
            >
              <CashReceiptFlow
                invoiceId={invoiceId}
                amount={amount}
                tenantName={tenantName}
                ownerName={ownerName}
                propertyAddress={propertyAddress}
                periode={periode}
                onComplete={handleCashReceiptComplete}
                onCancel={() => handleOpenChange(false)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

