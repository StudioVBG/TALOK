"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { buildAvatarUrl, formatFullName } from "@/lib/helpers/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { apiClient } from "@/lib/api-client";
import type { Profile } from "@/lib/types";

const MAX_AVATAR_SIZE_MB = 2;

export function ProfileGeneralForm() {
  const router = useRouter();
  const { profile, user, refreshProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    prenom: "",
    nom: "",
    telephone: "",
    date_naissance: "",
    lieu_naissance: "", // ✅ SOTA 2026: Ajout du lieu de naissance
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        prenom: profile.prenom ?? "",
        nom: profile.nom ?? "",
        telephone: profile.telephone ?? "",
        date_naissance: profile.date_naissance ?? "",
        lieu_naissance: (profile as any).lieu_naissance ?? "", // ✅ SOTA 2026
      });
    }
  }, [profile]);

  const initials = useMemo(() => {
    if (!profile) return "??";
    const prenomInitial = profile.prenom?.[0] ?? "";
    const nomInitial = profile.nom?.[0] ?? "";
    const fallback = (prenomInitial + nomInitial).toUpperCase();
    return fallback || (user?.email?.slice(0, 2).toUpperCase() ?? "??");
  }, [profile, user]);

  const handleFieldChange = (key: keyof typeof formData) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleProfileSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {};
      if (formData.prenom !== profile.prenom) payload.prenom = formData.prenom || null;
      if (formData.nom !== profile.nom) payload.nom = formData.nom || null;
      if ((formData.telephone || null) !== (profile.telephone || null)) {
        payload.telephone = formData.telephone || null;
      }
      if ((formData.date_naissance || null) !== (profile.date_naissance || null)) {
        payload.date_naissance = formData.date_naissance || null;
      }
      // ✅ SOTA 2026: Ajout du lieu de naissance
      if ((formData.lieu_naissance || null) !== ((profile as any).lieu_naissance || null)) {
        payload.lieu_naissance = formData.lieu_naissance || null;
      }

      if (Object.keys(payload).length === 0) {
        toast({
          title: "Aucune modification",
          description: "Mettez à jour un champ avant de sauvegarder.",
        });
        return;
      }

      const updatedProfile = await apiClient.patch<Profile>("/me/profile", payload);
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées.",
      });
      await refreshProfile();
      // Forcer le rechargement des données serveur (ex: complétion du profil sur le dashboard)
      router.refresh();
      setFormData({
        prenom: updatedProfile.prenom ?? "",
        nom: updatedProfile.nom ?? "",
        telephone: updatedProfile.telephone ?? "",
        date_naissance: updatedProfile.date_naissance ?? "",
        lieu_naissance: (updatedProfile as any).lieu_naissance ?? "", // ✅ SOTA 2026
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour votre profil.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

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

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/me/avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Erreur lors du téléversement.");
      }

      toast({
        title: "Avatar mis à jour",
        description: "Votre photo de profil a été mise à jour.",
      });
      await refreshProfile();
      // Forcer le rechargement des données serveur
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de mettre à jour l'avatar.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Identité & contact</CardTitle>
        <CardDescription>Mettre à jour vos informations principales</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Avatar className="h-20 w-20">
              <AvatarImage src={buildAvatarUrl(profile?.avatar_url) || undefined} />
              <AvatarFallback className="text-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-medium text-lg">
                {formatFullName(profile?.prenom || null, profile?.nom || null)}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              {profile?.role && (
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Rôle : {profile.role}
                </p>
              )}
              <div className="mt-3">
                <Label
                  htmlFor="avatar"
                  className="inline-flex cursor-pointer text-sm font-medium text-primary hover:underline"
                >
                  {loading ? "Téléversement en cours..." : "Changer de photo"}
                </Label>
                <Input
                  id="avatar"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleAvatarChange}
                  className="hidden"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  PNG, JPG ou WEBP • max {MAX_AVATAR_SIZE_MB} Mo
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleProfileSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                value={formData.prenom}
                onChange={handleFieldChange("prenom")}
                placeholder="Votre prénom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                value={formData.nom}
                onChange={handleFieldChange("nom")}
                placeholder="Votre nom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone</Label>
              <Input
                id="telephone"
                value={formData.telephone}
                onChange={handleFieldChange("telephone")}
                placeholder="+33612345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date_naissance">Date de naissance</Label>
              <Input
                id="date_naissance"
                type="date"
                value={formData.date_naissance || ""}
                onChange={handleFieldChange("date_naissance")}
                max={new Date().toISOString().split("T")[0]}
              />
            </div>
            {/* ✅ SOTA 2026: Lieu de naissance */}
            <div className="space-y-2">
              <Label htmlFor="lieu_naissance">Lieu de naissance</Label>
              <Input
                id="lieu_naissance"
                value={formData.lieu_naissance || ""}
                onChange={handleFieldChange("lieu_naissance")}
                placeholder="Ex: Paris"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

