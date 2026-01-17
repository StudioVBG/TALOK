"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { tenantPaymentSchema } from "@/lib/validations/onboarding";
import { CreditCard, ArrowRight, Banknote, ShieldCheck, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentMethodSetup } from "@/features/billing/components/v2/PaymentMethodSetup";
import { cn } from "@/lib/utils";

export default function TenantPaymentsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isColocation, setIsColocation] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    moyen_encaissement: "sepa_sdd" as "sepa_sdd" | "virement_sct" | "virement_inst" | "pay_by_bank" | "carte_wallet",
    sepa_mandat_accepte: false,
    part_percentage: "",
    part_montant: "",
  });

  useEffect(() => {
    // Charger le brouillon si disponible
    onboardingService.getDraft().then((draft) => {
      if (draft?.data && draft.role === "tenant") {
        const data = draft.data as any;
        setFormData((prev) => ({
          ...prev,
          ...data,
        }));
        if (data.stripe_payment_method_id) {
          setPaymentMethodId(data.stripe_payment_method_id);
        }
        // Vérifier si c'est une colocation
        if (data.role === "colocataire") {
          setIsColocation(true);
        }
      }
    });
  }, []);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Si on a choisi un mode automatique mais qu'on n'a pas enregistré de moyen Stripe
    if (["sepa_sdd", "carte_wallet"].includes(formData.moyen_encaissement) && !paymentMethodId) {
      toast({
        title: "Action requise",
        description: "Veuillez configurer votre moyen de paiement sécurisé ci-dessous.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const validated = tenantPaymentSchema.parse({
        moyen_encaissement: formData.moyen_encaissement,
        sepa_mandat_accepte: formData.moyen_encaissement === "sepa_sdd" ? formData.sepa_mandat_accepte : undefined,
        stripe_payment_method_id: paymentMethodId || undefined,
        part_percentage: isColocation && formData.part_percentage ? parseFloat(formData.part_percentage) : undefined,
        part_montant: isColocation && formData.part_montant ? parseFloat(formData.part_montant) : undefined,
      });

      // Sauvegarder les préférences
      await onboardingService.saveDraft("tenant_payment", validated, "tenant");
      await onboardingService.markStepCompleted("tenant_payment", "tenant");

      toast({
        title: "Préférences enregistrées",
        description: "Vos préférences de paiement ont été sauvegardées.",
      });

      // Rediriger vers la signature du bail
      router.push("/tenant/onboarding/sign");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isAutomatic = ["sepa_sdd", "carte_wallet"].includes(formData.moyen_encaissement);

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-2xl shadow-xl border-none">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl">Paiement & Loyer</CardTitle>
              <CardDescription>
                Configurez comment vous souhaitez régler vos loyers
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* Choix du mode */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base font-semibold">Mode de règlement préféré</Label>
                <Select
                  value={formData.moyen_encaissement}
                  onValueChange={(value: any) => {
                    setFormData({ ...formData, moyen_encaissement: value });
                    if (!["sepa_sdd", "carte_wallet"].includes(value)) {
                      setPaymentMethodId(null);
                    }
                  }}
                >
                  <SelectTrigger className="h-12 border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sepa_sdd">Prélèvement SEPA (Automatique)</SelectItem>
                    <SelectItem value="carte_wallet">Carte Bancaire / Apple Pay</SelectItem>
                    <SelectItem value="virement_sct">Virement Bancaire (Manuel)</SelectItem>
                    <SelectItem value="virement_inst">Virement Instantané</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Zone Stripe Elements */}
              {isAutomatic && (
                <div className={cn(
                  "p-6 border-2 rounded-2xl transition-all duration-300",
                  paymentMethodId ? "border-emerald-100 bg-emerald-50/30" : "border-blue-100 bg-blue-50/10"
                )}>
                  {paymentMethodId ? (
                    <div className="flex flex-col items-center py-4 space-y-3">
                      <div className="p-3 bg-emerald-100 rounded-full">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      </div>
                      <div className="text-center">
                        <p className="font-bold text-emerald-900">Moyen de paiement configuré</p>
                        <p className="text-sm text-emerald-700">Vos informations ont été mémorisées en toute sécurité.</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setPaymentMethodId(null)}
                        className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100"
                      >
                        Modifier le moyen de paiement
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-4">
                        <ShieldCheck className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-semibold text-blue-900">Configuration sécurisée Stripe</span>
                      </div>
                      <PaymentMethodSetup 
                        onSuccess={(id) => {
                          setPaymentMethodId(id);
                          toast({ title: "Succès", description: "Moyen de paiement enregistré." });
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {formData.moyen_encaissement === "sepa_sdd" && paymentMethodId && (
                <div className="flex items-start space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <input
                    type="checkbox"
                    id="sepa_mandat"
                    checked={formData.sepa_mandat_accepte}
                    onChange={(e) => setFormData({ ...formData, sepa_mandat_accepte: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <Label htmlFor="sepa_mandat" className="text-sm leading-snug text-slate-600 cursor-pointer">
                    J&apos;autorise l&apos;application à prélever automatiquement le montant de mon loyer et de mes charges sur le compte associé à ce moyen de paiement, conformément aux termes de mon bail.
                  </Label>
                </div>
              )}
            </div>

            {/* Part Colocation */}
            {isColocation && (
              <div className="space-y-4 p-5 bg-amber-50/30 border border-amber-100 rounded-2xl">
                <div className="flex items-center gap-2">
                  <Banknote className="w-5 h-5 text-amber-600" />
                  <h4 className="font-bold text-amber-900">Votre part du loyer</h4>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="part_percentage" className="text-amber-800">En pourcentage (%)</Label>
                    <div className="relative">
                      <Input
                        id="part_percentage"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={formData.part_percentage}
                        onChange={(e) => setFormData({ ...formData, part_percentage: e.target.value })}
                        className="bg-white border-amber-200 focus:ring-amber-500 pr-8"
                        placeholder="50"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold">%</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="part_montant" className="text-amber-800">En montant (€)</Label>
                    <div className="relative">
                      <Input
                        id="part_montant"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.part_montant}
                        onChange={(e) => setFormData({ ...formData, part_montant: e.target.value })}
                        className="bg-white border-amber-200 focus:ring-amber-500 pr-8"
                        placeholder="500"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-amber-400 font-bold">€</span>
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-amber-600/80 italic">
                  Ces informations permettront de générer automatiquement vos appels de loyers personnels.
                </p>
              </div>
            )}

            <Button 
              onClick={() => handleSubmit()} 
              className="w-full h-12 text-lg font-semibold bg-slate-900 hover:bg-slate-800 shadow-lg" 
              disabled={loading || (isAutomatic && !paymentMethodId)}
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <div className="flex items-center justify-center gap-2">
                  Continuer vers la signature
                  <ArrowRight className="w-5 h-5" />
                </div>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
