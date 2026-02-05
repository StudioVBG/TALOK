"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildAvatarUrl, formatFullName } from "@/lib/helpers/format";
import { useProfileForm } from "@/lib/hooks/use-profile-form";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { ProfileCompletion } from "@/components/profile/profile-completion";
import { SiretInput } from "@/components/profile/siret-input";
import type { OwnerType } from "@/lib/types";
import { useState } from "react";

const MAX_AVATAR_SIZE_MB = 2;

export function ProfileForm() {
  const router = useRouter();
  const { toast } = useToast();
  const {
    formData,
    isDirty,
    isLoading,
    isSaving,
    errors,
    updateField,
    handleSave,
    resetForm,
    profile,
    avatarUrl,
    userEmail,
  } = useProfileForm();

  useUnsavedChangesWarning(isDirty);

  const [avatarLoading, setAvatarLoading] = useState(false);

  const initials = useMemo(() => {
    if (!profile) return "??";
    const prenomInitial = profile.prenom?.[0] ?? "";
    const nomInitial = profile.nom?.[0] ?? "";
    const fallback = (prenomInitial + nomInitial).toUpperCase();
    return fallback || (userEmail?.slice(0, 2).toUpperCase() ?? "??");
  }, [profile, userEmail]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.[0]) return;
    const file = event.target.files[0];

    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: `La taille maximale est de ${MAX_AVATAR_SIZE_MB} Mo.`,
        variant: "destructive",
      });
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({
        title: "Format non supporté",
        description: "Formats acceptés : JPEG, PNG ou WEBP.",
        variant: "destructive",
      });
      return;
    }

    setAvatarLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const response = await fetch("/api/me/avatar", {
        method: "POST",
        body: fd,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Erreur lors du téléversement.");
      }

      toast({
        title: "Avatar mis à jour",
        description: "Votre photo de profil a été mise à jour.",
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour l'avatar.",
        variant: "destructive",
      });
    } finally {
      setAvatarLoading(false);
      event.target.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with completion indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mon profil</h1>
          <p className="text-muted-foreground">Gérez vos informations personnelles</p>
        </div>
        <ProfileCompletion data={formData} />
      </div>

      {/* Required fields note */}
      <p className="text-sm text-muted-foreground">
        Les champs marqués d&apos;un <span className="text-destructive">*</span> sont obligatoires.
      </p>

      {/* Section: Identity & Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Identité &amp; contact</CardTitle>
          <CardDescription>Mettre à jour vos informations principales</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-6">
            {/* Avatar section */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={buildAvatarUrl(avatarUrl) || undefined} />
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <p className="font-medium text-lg">
                  {formatFullName(formData.prenom || null, formData.nom || null)}
                </p>
                <TooltipProvider delayDuration={0}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-muted-foreground">{userEmail}</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-xs max-w-[200px]">L&apos;adresse e-mail est liée à votre compte et ne peut pas être modifiée ici. Contactez le support si nécessaire.</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {profile?.role && (
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rôle : {profile.role}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="text-xs max-w-[200px]">Le rôle est défini lors de la création du compte et ne peut pas être modifié.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </TooltipProvider>
                <div className="mt-3">
                  <Label
                    htmlFor="avatar"
                    className="inline-flex cursor-pointer text-sm font-medium text-primary hover:underline"
                  >
                    {avatarLoading ? "Téléversement en cours..." : "Changer de photo"}
                  </Label>
                  <Input
                    id="avatar"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleAvatarChange}
                    className="hidden"
                    disabled={avatarLoading}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    PNG, JPG ou WEBP &bull; max {MAX_AVATAR_SIZE_MB} Mo
                  </p>
                </div>
              </div>
            </div>

            {/* Identity fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prenom">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) => updateField("prenom", e.target.value)}
                  placeholder="Votre prénom"
                  error={errors.prenom}
                  aria-required="true"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) => updateField("nom", e.target.value)}
                  placeholder="Votre nom"
                  error={errors.nom}
                  aria-required="true"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => updateField("telephone", e.target.value)}
                  placeholder="+33612345678"
                  error={errors.telephone}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date_naissance">Date de naissance</Label>
                <Input
                  id="date_naissance"
                  type="date"
                  value={formData.date_naissance || ""}
                  onChange={(e) => updateField("date_naissance", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lieu_naissance">Lieu de naissance</Label>
                <Input
                  id="lieu_naissance"
                  value={formData.lieu_naissance || ""}
                  onChange={(e) => updateField("lieu_naissance", e.target.value)}
                  placeholder="Ex: Paris"
                />
                <p className="text-xs text-muted-foreground">
                  Requis pour certains documents officiels
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section: Owner Profile */}
      <Card>
        <CardHeader>
          <CardTitle>Profil propriétaire</CardTitle>
          <CardDescription>Complétez vos informations de propriétaire</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owner type selector */}
          <div className="space-y-2">
            <Label htmlFor="owner_type">
              Type de propriétaire <span className="text-destructive">*</span>
            </Label>
            <select
              id="owner_type"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.owner_type}
              onChange={(e) => updateField("owner_type", e.target.value as OwnerType)}
              disabled={isSaving}
              aria-required="true"
            >
              <option value="particulier">Particulier</option>
              <option value="societe">Société</option>
            </select>
          </div>

          {/* Company-specific fields (conditional) */}
          {formData.owner_type === "societe" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="raison_sociale">
                  Raison sociale <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="raison_sociale"
                  value={formData.raison_sociale}
                  onChange={(e) => updateField("raison_sociale", e.target.value)}
                  error={errors.raison_sociale}
                  disabled={isSaving}
                  aria-required="true"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="forme_juridique">
                  Forme juridique <span className="text-destructive">*</span>
                </Label>
                <select
                  id="forme_juridique"
                  className={`flex h-11 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    errors.forme_juridique ? "border-destructive" : "border-input"
                  }`}
                  value={formData.forme_juridique}
                  onChange={(e) => updateField("forme_juridique", e.target.value)}
                  disabled={isSaving}
                  aria-required="true"
                  aria-invalid={!!errors.forme_juridique}
                >
                  <option value="">Sélectionner...</option>
                  <option value="SCI">SCI</option>
                  <option value="SARL">SARL</option>
                  <option value="SAS">SAS</option>
                  <option value="SASU">SASU</option>
                  <option value="EURL">EURL</option>
                  <option value="EI">Entreprise Individuelle</option>
                  <option value="SA">SA</option>
                  <option value="SCPI">SCPI</option>
                  <option value="autre">Autre</option>
                </select>
                {errors.forme_juridique && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.forme_juridique}
                  </p>
                )}
              </div>

              <SiretInput
                value={formData.siret}
                onChange={(value) => updateField("siret", value)}
                error={errors.siret}
                disabled={isSaving}
              />

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="adresse_siege">
                  Adresse du siège social <span className="text-destructive">*</span>
                </Label>
                <textarea
                  id="adresse_siege"
                  className={`flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    errors.adresse_siege ? "border-destructive" : "border-input"
                  }`}
                  value={formData.adresse_siege}
                  onChange={(e) => updateField("adresse_siege", e.target.value)}
                  disabled={isSaving}
                  aria-required="true"
                  aria-invalid={!!errors.adresse_siege}
                />
                {errors.adresse_siege && (
                  <p className="text-sm text-destructive" role="alert">
                    {errors.adresse_siege}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tva">Numéro TVA (optionnel)</Label>
                <Input
                  id="tva"
                  value={formData.tva}
                  onChange={(e) => updateField("tva", e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>
          )}

          {/* Always-visible optional fields */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="iban">IBAN (optionnel)</Label>
              <Input
                id="iban"
                value={formData.iban}
                onChange={(e) => updateField("iban", e.target.value)}
                placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                error={errors.iban}
                disabled={isSaving}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="adresse_facturation">
                Adresse de facturation (optionnel)
              </Label>
              <textarea
                id="adresse_facturation"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={formData.adresse_facturation}
                onChange={(e) => updateField("adresse_facturation", e.target.value)}
                disabled={isSaving}
                placeholder="Si différente de l'adresse du siège"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Unified save button */}
      <div className="flex justify-end gap-3 pt-2">
        {isDirty && (
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            disabled={isSaving}
          >
            Annuler les modifications
          </Button>
        )}
        <Button
          onClick={handleSave}
          disabled={!isDirty || isSaving}
          loading={isSaving}
          loadingText="Enregistrement..."
          className="min-w-[220px]"
        >
          Enregistrer les modifications
        </Button>
      </div>
    </div>
  );
}
