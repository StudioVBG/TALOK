"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Save, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  createGuarantorProfileSchema,
  updateGuarantorProfileSchema,
  type UpdateGuarantorProfileInput,
} from "@/lib/validations/guarantor";
import { guarantorProfilesService } from "@/features/profiles/services/guarantor-profiles.service";
import type { GuarantorProfile } from "@/lib/types/guarantor";
import {
  GUARANTOR_RELATION_LABELS,
  GUARANTOR_SITUATION_LABELS,
  type GuarantorRelation,
  type GuarantorSituationPro,
} from "@/lib/types/guarantor";

export default function GuarantorProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingProfile, setExistingProfile] = useState<GuarantorProfile | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateGuarantorProfileInput>({
    resolver: zodResolver(updateGuarantorProfileSchema),
    defaultValues: {
      relation_to_tenant: "parent",
      revenus_fonciers: 0,
      autres_revenus: 0,
      charges_mensuelles: 0,
      credits_en_cours: 0,
      est_proprietaire: false,
      consent_garant: false,
      consent_data_processing: false,
    },
  });

  useEffect(() => {
    async function loadProfile() {
      try {
        const profile = await guarantorProfilesService.getMyProfile();
        if (profile) {
          setExistingProfile(profile);
          // Pré-remplir le formulaire
          Object.entries(profile).forEach(([key, value]) => {
            if (value !== null && value !== undefined) {
              setValue(key as keyof UpdateGuarantorProfileInput, value as any);
            }
          });
        }
      } catch (error: unknown) {
        console.error("Erreur chargement profil:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [setValue]);

  const onSubmit = async (data: UpdateGuarantorProfileInput) => {
    setSaving(true);
    try {
      if (existingProfile) {
        await guarantorProfilesService.updateProfile(data);
        toast({
          title: "Profil mis à jour",
          description: "Vos informations ont été enregistrées.",
        });
      } else {
        await guarantorProfilesService.createProfile(data as any);
        toast({
          title: "Profil créé",
          description: "Votre profil garant a été créé avec succès.",
        });
        router.push("/guarantor/dashboard");
      }
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setSaving(false);
    }
  };

  const consentGarant = watch("consent_garant");
  const consentData = watch("consent_data_processing");

  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {existingProfile ? "Mon profil garant" : "Créer mon profil garant"}
        </h1>
        <p className="text-muted-foreground">
          {existingProfile
            ? "Mettez à jour vos informations de garant"
            : "Renseignez vos informations pour vous porter caution"}
        </p>
      </div>

      {existingProfile?.documents_verified && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Votre profil a été vérifié. Vous pouvez vous porter caution.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Relation avec le locataire */}
        <Card>
          <CardHeader>
            <CardTitle>Relation avec le locataire</CardTitle>
            <CardDescription>
              Indiquez votre lien avec le locataire que vous cautionnez
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Type de relation *</Label>
              <Select
                value={watch("relation_to_tenant")}
                onValueChange={(value) =>
                  setValue("relation_to_tenant", value as GuarantorRelation)
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
              {errors.relation_to_tenant && (
                <p className="text-sm text-destructive">
                  {errors.relation_to_tenant.message}
                </p>
              )}
            </div>

            {watch("relation_to_tenant") === "autre" && (
              <div className="space-y-2">
                <Label>Précisez</Label>
                <Input
                  {...register("relation_details")}
                  placeholder="Décrivez votre relation..."
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Situation professionnelle */}
        <Card>
          <CardHeader>
            <CardTitle>Situation professionnelle</CardTitle>
            <CardDescription>
              Ces informations permettent d'évaluer votre capacité à vous porter caution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Situation *</Label>
              <Select
                value={watch("situation_pro") || ""}
                onValueChange={(value) =>
                  setValue("situation_pro", value as GuarantorSituationPro)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(GUARANTOR_SITUATION_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nom de l'employeur</Label>
                <Input
                  {...register("employeur_nom")}
                  placeholder="Société XYZ"
                />
              </div>
              <div className="space-y-2">
                <Label>Ancienneté (en mois)</Label>
                <Input
                  type="number"
                  {...register("anciennete_mois", { valueAsNumber: true })}
                  placeholder="24"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Adresse de l'employeur</Label>
              <Input
                {...register("employeur_adresse")}
                placeholder="1 rue de Paris, 75001 Paris"
              />
            </div>
          </CardContent>
        </Card>

        {/* Informations financières */}
        <Card>
          <CardHeader>
            <CardTitle>Informations financières</CardTitle>
            <CardDescription>
              Vos revenus doivent être au minimum 3 fois le montant du loyer
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Revenus mensuels nets *</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("revenus_mensuels_nets", { valueAsNumber: true })}
                  placeholder="3000"
                />
                {errors.revenus_mensuels_nets && (
                  <p className="text-sm text-destructive">
                    {errors.revenus_mensuels_nets.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Revenus fonciers mensuels</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("revenus_fonciers", { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Autres revenus mensuels</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("autres_revenus", { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label>Charges mensuelles</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("charges_mensuelles", { valueAsNumber: true })}
                  placeholder="500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Crédits en cours (mensualités)</Label>
              <Input
                type="number"
                step="0.01"
                {...register("credits_en_cours", { valueAsNumber: true })}
                placeholder="0"
              />
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="est_proprietaire"
                checked={watch("est_proprietaire")}
                onCheckedChange={(checked) =>
                  setValue("est_proprietaire", checked as boolean)
                }
              />
              <Label htmlFor="est_proprietaire" className="cursor-pointer">
                Je suis propriétaire d'un bien immobilier
              </Label>
            </div>

            {watch("est_proprietaire") && (
              <div className="space-y-2">
                <Label>Valeur estimée du patrimoine immobilier</Label>
                <Input
                  type="number"
                  step="0.01"
                  {...register("valeur_patrimoine_immobilier", { valueAsNumber: true })}
                  placeholder="200000"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader>
            <CardTitle>Adresse</CardTitle>
            <CardDescription>Votre adresse de résidence actuelle</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Adresse complète *</Label>
              <Input
                {...register("adresse_complete")}
                placeholder="1 rue de Paris"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Code postal *</Label>
                <Input
                  {...register("code_postal")}
                  placeholder="75001"
                  maxLength={5}
                />
                {errors.code_postal && (
                  <p className="text-sm text-destructive">
                    {errors.code_postal.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Ville *</Label>
                <Input {...register("ville")} placeholder="Paris" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consentements */}
        <Card>
          <CardHeader>
            <CardTitle>Consentements</CardTitle>
            <CardDescription>
              Veuillez lire et accepter les conditions ci-dessous
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <Checkbox
                id="consent_garant"
                checked={consentGarant}
                onCheckedChange={(checked) =>
                  setValue("consent_garant", checked as boolean)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="consent_garant" className="cursor-pointer font-medium">
                  J'accepte de me porter caution *
                </Label>
                <p className="text-sm text-muted-foreground">
                  Je comprends qu'en me portant caution, je m'engage à payer le loyer
                  et les charges en cas de défaillance du locataire, dans les limites
                  prévues par la loi et l'acte de cautionnement.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-4 border rounded-lg">
              <Checkbox
                id="consent_data"
                checked={consentData}
                onCheckedChange={(checked) =>
                  setValue("consent_data_processing", checked as boolean)
                }
              />
              <div className="space-y-1">
                <Label htmlFor="consent_data" className="cursor-pointer font-medium">
                  J'accepte le traitement de mes données *
                </Label>
                <p className="text-sm text-muted-foreground">
                  J'autorise le traitement de mes données personnelles et financières
                  dans le cadre de l'évaluation de ma capacité à me porter caution,
                  conformément au RGPD.
                </p>
              </div>
            </div>

            {(!consentGarant || !consentData) && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Vous devez accepter les deux consentements pour pouvoir vous
                  porter caution.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={saving || !consentGarant || !consentData}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {existingProfile ? "Enregistrer" : "Créer mon profil"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}







