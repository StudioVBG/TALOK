"use client";

/**
 * ProfileIdentityTab — Onglet Identité & Contact du profil propriétaire
 *
 * Extrait depuis profile-form.tsx pour la refonte en onglets.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Info, Building2, ArrowRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { buildAvatarUrl, formatFullName } from "@/lib/helpers/format";
import { useEntityStore } from "@/stores/useEntityStore";
import type { ProfileFormData, ProfileFormErrors } from "@/lib/hooks/use-profile-form";
import type { OwnerType, Profile } from "@/lib/types";
import Link from "next/link";

const MAX_AVATAR_SIZE_MB = 2;

interface ProfileIdentityTabProps {
  formData: ProfileFormData;
  errors: ProfileFormErrors;
  isSaving: boolean;
  profile: Profile | null;
  avatarUrl: string | null;
  userEmail: string | null;
  updateField: <K extends keyof ProfileFormData>(
    key: K,
    value: ProfileFormData[K]
  ) => void;
  onSwitchToEntities?: () => void;
}

export function ProfileIdentityTab({
  formData,
  errors,
  isSaving,
  profile,
  avatarUrl,
  userEmail,
  updateField,
  onSwitchToEntities,
}: ProfileIdentityTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [avatarLoading, setAvatarLoading] = useState(false);

  const initials = useMemo(() => {
    if (!profile) return "??";
    const prenomInitial = profile.prenom?.[0] ?? "";
    const nomInitial = profile.nom?.[0] ?? "";
    const fallback = (prenomInitial + nomInitial).toUpperCase();
    return fallback || (userEmail?.slice(0, 2).toUpperCase() ?? "??");
  }, [profile, userEmail]);

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
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
        description:
          error instanceof Error
            ? error.message
            : "Impossible de mettre à jour l'avatar.",
        variant: "destructive",
      });
    } finally {
      setAvatarLoading(false);
      event.target.value = "";
    }
  };

  const roleLabel =
    profile?.role === "owner"
      ? "Propriétaire"
      : profile?.role === "tenant"
        ? "Locataire"
        : profile?.role || "";

  return (
    <div className="space-y-6">
      {/* Section: Identity & Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Identité &amp; contact</CardTitle>
          <CardDescription>
            Mettre à jour vos informations principales
          </CardDescription>
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
                  {formatFullName(
                    formData.prenom || null,
                    formData.nom || null
                  )}
                </p>
                <TooltipProvider delayDuration={0}>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm text-muted-foreground">{userEmail}</p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help shrink-0" />
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p className="text-xs max-w-[200px]">
                          L&apos;adresse e-mail est liée à votre compte et ne
                          peut pas être modifiée ici. Contactez le support si
                          nécessaire.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {profile?.role && (
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Rôle : {roleLabel}
                      </p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent side="right">
                          <p className="text-xs max-w-[200px]">
                            Le rôle est défini lors de la création du compte et
                            ne peut pas être modifié.
                          </p>
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
                    {avatarLoading
                      ? "Téléversement en cours..."
                      : "Changer de photo"}
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
                  onChange={(e) =>
                    updateField("date_naissance", e.target.value)
                  }
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="lieu_naissance">Lieu de naissance</Label>
                <Input
                  id="lieu_naissance"
                  value={formData.lieu_naissance || ""}
                  onChange={(e) =>
                    updateField("lieu_naissance", e.target.value)
                  }
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
          <CardDescription>
            Complétez vos informations de propriétaire
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Owner type selector */}
          <div className="space-y-2">
            <Label htmlFor="owner_type">
              Type de propriétaire{" "}
              <span className="text-destructive">*</span>
            </Label>
            <select
              id="owner_type"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={formData.owner_type}
              onChange={(e) =>
                updateField("owner_type", e.target.value as OwnerType)
              }
              disabled={isSaving}
              aria-required="true"
            >
              <option value="particulier">Particulier</option>
              <option value="societe">Société</option>
            </select>
          </div>

          {/* CTA: Entity management for company owners */}
          {formData.owner_type === "societe" && (
            <EntityMigrationCTA onSwitchToEntities={onSwitchToEntities} />
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
                onChange={(e) =>
                  updateField("adresse_facturation", e.target.value)
                }
                disabled={isSaving}
                placeholder="Si différente de l'adresse du siège"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * CTA displayed when owner_type is "societe" — directs user to manage entities
 * in the dedicated Entities tab / page instead of inline fields.
 */
function EntityMigrationCTA({
  onSwitchToEntities,
}: {
  onSwitchToEntities?: () => void;
}) {
  const { entities, isLoading } = useEntityStore();

  if (isLoading) return null;

  if (entities.length > 0) {
    return (
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-3">
          <Building2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {entities.length} entit&eacute;{entities.length > 1 ? "s" : ""} juridique{entities.length > 1 ? "s" : ""} configur&eacute;e{entities.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              G&eacute;rez vos entit&eacute;s juridiques (raison sociale, SIRET, forme juridique...)
              depuis l&apos;onglet Entit&eacute;s ou la page d&eacute;di&eacute;e.
            </p>
            {onSwitchToEntities ? (
              <Button
                variant="link"
                size="sm"
                className="px-0 h-auto mt-2"
                onClick={onSwitchToEntities}
              >
                Voir mes entit&eacute;s
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            ) : (
              <Button variant="link" size="sm" className="px-0 h-auto mt-2" asChild>
                <Link href="/owner/entities">
                  Voir mes entit&eacute;s
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 p-4">
      <div className="flex items-start gap-3">
        <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Cr&eacute;ez votre entit&eacute; juridique
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
            En tant que soci&eacute;t&eacute;, cr&eacute;ez une entit&eacute; juridique (SCI, SARL, SAS...)
            pour renseigner votre raison sociale, SIRET, si&egrave;ge social et autres
            informations l&eacute;gales utilis&eacute;es dans vos documents.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {onSwitchToEntities && (
              <Button size="sm" onClick={onSwitchToEntities}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Cr&eacute;er maintenant
              </Button>
            )}
            <Button
              size="sm"
              variant={onSwitchToEntities ? "outline" : "default"}
              asChild
            >
              <Link href="/owner/entities/new">
                <Building2 className="h-4 w-4 mr-2" />
                Cr&eacute;er mon entit&eacute;
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
