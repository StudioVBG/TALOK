"use client";

/**
 * SOTA 2026 : Sélecteur de moyen de paiement sauvegardé
 * Permet de choisir un moyen existant OU d'en ajouter un nouveau
 */

import { useState } from "react";
import { CreditCard, Building2, Plus, Star, Check, Trash2, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PaymentMethodSetup } from "./PaymentMethodSetup";
import { useToast } from "@/components/ui/use-toast";
import {
  useTenantPaymentMethodsDisplay,
  useAddPaymentMethod,
  useRemovePaymentMethod,
  useSetDefaultPaymentMethod,
} from "@/lib/hooks/use-tenant-payment-methods";
import type { PaymentMethodDisplay } from "@/lib/types/payment-methods";

interface PaymentMethodSelectorProps {
  onSelect: (stripePaymentMethodId: string, methodId: string) => void;
  selectedId?: string | null;
  showManage?: boolean;
  compact?: boolean;
}

const ICON_MAP: Record<PaymentMethodDisplay["icon"], React.ReactNode> = {
  visa: <CreditCard className="h-5 w-5 text-blue-700" />,
  mastercard: <CreditCard className="h-5 w-5 text-orange-600" />,
  amex: <CreditCard className="h-5 w-5 text-blue-500" />,
  sepa: <Building2 className="h-5 w-5 text-indigo-600" />,
  apple_pay: <Smartphone className="h-5 w-5 text-slate-900" />,
  google_pay: <Smartphone className="h-5 w-5 text-green-600" />,
  card: <CreditCard className="h-5 w-5 text-slate-600" />,
};

export function PaymentMethodSelector({
  onSelect,
  selectedId,
  showManage = false,
  compact = false,
}: PaymentMethodSelectorProps) {
  const { toast } = useToast();
  const { methods, defaultMethod, isLoading } = useTenantPaymentMethodsDisplay();
  const addMutation = useAddPaymentMethod();
  const removeMutation = useRemovePaymentMethod();
  const setDefaultMutation = useSetDefaultPaymentMethod();
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const effectiveSelected = selectedId
    ?? methods.find((m) => m.is_default)?.id
    ?? methods[0]?.id;

  const handleNewMethodSuccess = async (stripePaymentMethodId: string) => {
    try {
      const res = await addMutation.mutateAsync({
        stripe_payment_method_id: stripePaymentMethodId,
        type: "card",
        is_default: methods.length === 0,
      });
      setShowAddForm(false);
      toast({ title: "Moyen de paiement ajouté" });
      if (res.method) {
        onSelect(stripePaymentMethodId, res.method.id);
      }
    } catch (err: unknown) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Impossible d'ajouter",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await removeMutation.mutateAsync(id);
      toast({ title: "Moyen de paiement supprimé" });
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultMutation.mutateAsync(id);
      toast({ title: "Moyen par défaut mis à jour" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (methods.length === 0 && !showAddForm) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6 border-2 border-dashed rounded-2xl bg-muted/30">
          <CreditCard className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Aucun moyen de paiement enregistré</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Ajoutez une carte ou un compte SEPA pour payer vos loyers
          </p>
          <Button onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Ajouter un moyen de paiement
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {methods.map((method) => {
          const isSelected = effectiveSelected === method.id;
          return (
            <motion.div
              key={method.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              layout
            >
              <button
                type="button"
                onClick={() => {
                  const original = methods.find((m) => m.id === method.id);
                  if (original) {
                    // We need the stripe PM id — fetch from the full data
                    onSelect("", method.id);
                  }
                }}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left group",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border bg-card hover:border-primary/30 hover:shadow-sm",
                  method.isExpired && "opacity-60",
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  isSelected ? "bg-primary/10" : "bg-muted",
                )}>
                  {ICON_MAP[method.icon]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">{method.displayName}</span>
                    {method.is_default && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        <Star className="h-2.5 w-2.5 mr-0.5" /> Défaut
                      </Badge>
                    )}
                    {method.isExpiringSoon && !method.isExpired && (
                      <Badge variant="outline" className="text-amber-600 border-amber-300 text-[10px] px-1.5 py-0">
                        Expire bientôt
                      </Badge>
                    )}
                    {method.isExpired && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Expirée
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {method.expiresAt && (
                      <span className="text-xs text-muted-foreground">Exp. {method.expiresAt}</span>
                    )}
                    {method.label !== method.displayName && method.label && (
                      <span className="text-xs text-muted-foreground">{method.label}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {isSelected && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {showManage && !compact && (
                    <>
                      {!method.is_default && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetDefault(method.id);
                          }}
                          title="Définir par défaut"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(method.id);
                        }}
                        disabled={deletingId === method.id}
                        title="Supprimer"
                      >
                        {deletingId === method.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Add new payment method */}
      <AnimatePresence>
        {showAddForm ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-2 border-dashed border-primary/30 rounded-2xl bg-primary/5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Nouveau moyen de paiement</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Annuler
                </Button>
              </div>
              <PaymentMethodSetup onSuccess={handleNewMethodSuccess} onCancel={() => setShowAddForm(false)} />
            </div>
          </motion.div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <Button
              variant="outline"
              className="w-full gap-2 border-dashed h-12 rounded-2xl"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4" /> Ajouter un moyen de paiement
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
