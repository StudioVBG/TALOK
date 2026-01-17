"use client";
// @ts-nocheck

import { useState } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Globe,
  Briefcase,
  Euro,
  Save,
  Loader2,
  CheckCircle,
  Shield,
  Camera,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildAvatarUrl } from "@/lib/helpers/format";

interface Profile {
  id: string;
  user_id: string;
  role: string;
  prenom: string | null;
  nom: string | null;
  email: string | null;
  telephone: string | null;
  avatar_url: string | null;
  date_naissance: string | null;
  lieu_naissance: string | null;
  nationalite: string | null;
  adresse: string | null;
}

interface TenantProfile {
  profile_id: string;
  situation_pro: string | null;
  revenus_mensuels: number | null;
  nb_adultes: number;
  nb_enfants: number;
  garant_required: boolean;
}

interface TenantSettingsClientProps {
  profile: Profile;
  tenantProfile: TenantProfile | null;
  userEmail: string;
}

const SITUATION_PRO_OPTIONS = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "interim", label: "Intérim" },
  { value: "independant", label: "Indépendant / Freelance" },
  { value: "fonctionnaire", label: "Fonctionnaire" },
  { value: "retraite", label: "Retraité" },
  { value: "etudiant", label: "Étudiant" },
  { value: "chomage", label: "Demandeur d'emploi" },
  { value: "autre", label: "Autre" },
];

export function TenantSettingsClient({
  profile,
  tenantProfile,
  userEmail,
}: TenantSettingsClientProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // État du formulaire
  const [formData, setFormData] = useState({
    prenom: profile.prenom || "",
    nom: profile.nom || "",
    telephone: profile.telephone || "",
    date_naissance: profile.date_naissance || "",
    lieu_naissance: profile.lieu_naissance || "",
    nationalite: profile.nationalite || "Française",
    adresse: profile.adresse || "",
    situation_pro: tenantProfile?.situation_pro || "",
    revenus_mensuels: tenantProfile?.revenus_mensuels?.toString() || "",
    nb_adultes: tenantProfile?.nb_adultes || 1,
    nb_enfants: tenantProfile?.nb_enfants || 0,
  });

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/tenant/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: profile.id,
          ...formData,
          revenus_mensuels: formData.revenus_mensuels
            ? parseInt(formData.revenus_mensuels, 10)
            : null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la sauvegarde");
      }

      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées avec succès.",
      });
      setHasChanges(false);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder le profil",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const initials = `${formData.prenom?.[0] || ""}${formData.nom?.[0] || ""}`.toUpperCase() || "?";

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* En-tête */}
        <div className="flex items-center gap-4 mb-8">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={buildAvatarUrl(profile.avatar_url) || undefined} />
              <AvatarFallback className="text-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              className="absolute bottom-0 right-0 p-1.5 bg-white dark:bg-slate-800 rounded-full shadow-lg border hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <Camera className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Paramètres du compte</h1>
            <p className="text-muted-foreground">
              Gérez vos informations personnelles et professionnelles
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informations personnelles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Informations personnelles
              </CardTitle>
              <CardDescription>
                Ces informations apparaissent sur vos documents officiels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prenom">Prénom</Label>
                  <Input
                    id="prenom"
                    value={formData.prenom}
                    onChange={(e) => handleChange("prenom", e.target.value)}
                    placeholder="Votre prénom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nom">Nom</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => handleChange("nom", e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date_naissance">Date de naissance</Label>
                  <Input
                    id="date_naissance"
                    type="date"
                    value={formData.date_naissance}
                    onChange={(e) => handleChange("date_naissance", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lieu_naissance">Lieu de naissance</Label>
                  <Input
                    id="lieu_naissance"
                    value={formData.lieu_naissance}
                    onChange={(e) => handleChange("lieu_naissance", e.target.value)}
                    placeholder="Ville de naissance"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nationalite">Nationalité</Label>
                <Input
                  id="nationalite"
                  value={formData.nationalite}
                  onChange={(e) => handleChange("nationalite", e.target.value)}
                  placeholder="Française"
                />
              </div>
            </CardContent>
          </Card>

          {/* Coordonnées */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-green-600" />
                Coordonnées
              </CardTitle>
              <CardDescription>
                Vos moyens de contact
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="email"
                    type="email"
                    value={userEmail}
                    disabled
                    className="bg-slate-100 dark:bg-slate-800"
                  />
                  <Shield className="h-5 w-5 text-green-600" title="Email vérifié" />
                </div>
                <p className="text-xs text-muted-foreground">
                  L'email est lié à votre compte et ne peut pas être modifié ici
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telephone">Téléphone</Label>
                <Input
                  id="telephone"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => handleChange("telephone", e.target.value)}
                  placeholder="06 12 34 56 78"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adresse">Adresse actuelle</Label>
                <Input
                  id="adresse"
                  value={formData.adresse}
                  onChange={(e) => handleChange("adresse", e.target.value)}
                  placeholder="123 rue de la Paix, 75001 Paris"
                />
              </div>
            </CardContent>
          </Card>

          {/* Situation professionnelle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-purple-600" />
                Situation professionnelle
              </CardTitle>
              <CardDescription>
                Informations utilisées pour les dossiers de location
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="situation_pro">Situation</Label>
                  <Select
                    value={formData.situation_pro}
                    onValueChange={(value) => handleChange("situation_pro", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {SITUATION_PRO_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="revenus_mensuels">Revenus mensuels nets (€)</Label>
                  <Input
                    id="revenus_mensuels"
                    type="number"
                    value={formData.revenus_mensuels}
                    onChange={(e) => handleChange("revenus_mensuels", e.target.value)}
                    placeholder="2500"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nb_adultes">Nombre d'adultes dans le foyer</Label>
                  <Input
                    id="nb_adultes"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.nb_adultes}
                    onChange={(e) => handleChange("nb_adultes", parseInt(e.target.value, 10) || 1)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nb_enfants">Nombre d'enfants</Label>
                  <Input
                    id="nb_enfants"
                    type="number"
                    min={0}
                    max={20}
                    value={formData.nb_enfants}
                    onChange={(e) => handleChange("nb_enfants", parseInt(e.target.value, 10) || 0)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bouton de sauvegarde */}
          <div className="flex justify-end gap-3 pt-4">
            {hasChanges && (
              <p className="text-sm text-amber-600 self-center">
                Vous avez des modifications non enregistrées
              </p>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !hasChanges}
              className="gap-2 bg-gradient-to-r from-blue-600 to-purple-600"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Enregistrer les modifications
                </>
              )}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}






