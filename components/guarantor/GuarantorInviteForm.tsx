"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, UserPlus, CheckCircle2, Shield } from "lucide-react";
import {
  createGuarantorInvitationSchema,
  type CreateGuarantorInvitationInput,
} from "@/lib/validations/guarantor";
import {
  CAUTION_TYPE_LABELS,
  GUARANTOR_RELATION_LABELS,
  type CautionType,
  type GuarantorRelation,
} from "@/lib/types/guarantor";

interface GuarantorInviteFormProps {
  leaseId: string;
  tenantProfileId: string;
  onSuccess?: () => void;
}

export function GuarantorInviteForm({
  leaseId,
  tenantProfileId,
  onSuccess,
}: GuarantorInviteFormProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateGuarantorInvitationInput>({
    resolver: zodResolver(createGuarantorInvitationSchema),
    defaultValues: {
      lease_id: leaseId,
      tenant_profile_id: tenantProfileId,
      guarantor_type: "solidaire",
    },
  });

  const selectedType = watch("guarantor_type");

  const onSubmit = async (data: CreateGuarantorInvitationInput) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/guarantors/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de l'envoi de l'invitation");
      }

      setSent(true);
      toast({
        title: "Invitation envoyée",
        description: `L'invitation a été envoyée à ${data.guarantor_email}`,
      });
      onSuccess?.();
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Invitation envoyée !</h3>
          <p className="text-muted-foreground">
            Le garant recevra un email avec un lien pour créer son compte et compléter son dossier.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          <CardTitle>Inviter un garant</CardTitle>
        </div>
        <CardDescription>
          Envoyez une invitation par email au garant du locataire. Il recevra un lien pour créer son compte.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nom complet du garant *</Label>
              <Input
                {...register("guarantor_name")}
                placeholder="Jean Dupont"
              />
              {errors.guarantor_name && (
                <p className="text-sm text-destructive">{errors.guarantor_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Email du garant *</Label>
              <Input
                type="email"
                {...register("guarantor_email")}
                placeholder="garant@email.com"
              />
              {errors.guarantor_email && (
                <p className="text-sm text-destructive">{errors.guarantor_email.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Téléphone (optionnel)</Label>
              <Input
                {...register("guarantor_phone")}
                placeholder="+33612345678"
              />
              {errors.guarantor_phone && (
                <p className="text-sm text-destructive">{errors.guarantor_phone.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Lien avec le locataire</Label>
              <Select
                value={watch("relationship") || ""}
                onValueChange={(value) =>
                  setValue("relationship", value as GuarantorRelation)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GUARANTOR_RELATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type de caution *</Label>
            <Select
              value={selectedType}
              onValueChange={(value) =>
                setValue("guarantor_type", value as CautionType)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CAUTION_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedType === "visale" && (
            <Alert className="bg-blue-50 border-blue-200">
              <Shield className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 text-sm">
                <strong>Garantie Visale</strong> : Le garant devra fournir son numéro de visa Visale
                lors de son inscription. La garantie Visale est gratuite et couvre les impayés de loyer
                pendant toute la durée du bail.
              </AlertDescription>
            </Alert>
          )}

          {selectedType === "simple" && (
            <Alert>
              <AlertDescription className="text-sm">
                <strong>Caution simple</strong> : Le bailleur ne peut exiger le paiement au garant
                qu'après avoir poursuivi le locataire sans succès (bénéfice de discussion).
              </AlertDescription>
            </Alert>
          )}

          {selectedType === "solidaire" && (
            <Alert>
              <AlertDescription className="text-sm">
                <strong>Caution solidaire</strong> : Le bailleur peut exiger le paiement directement
                au garant dès le premier impayé, sans poursuivre le locataire au préalable.
              </AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Envoyer l'invitation
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
