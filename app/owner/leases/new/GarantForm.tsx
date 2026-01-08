"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, UserCheck, Building2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Garant {
  nom: string;
  prenom: string;
  adresse: string;
  code_postal: string;
  ville: string;
  email?: string;
  telephone?: string;
  type_garantie: "personne_physique" | "personne_morale" | "visale" | "glj";
  // Si personne physique
  date_naissance?: string;
  lieu_naissance?: string;
  lien_parente?: string;
  // Si personne morale
  raison_sociale?: string;
  siret?: string;
}

interface GarantFormProps {
  garant: Garant | null;
  onGarantChange: (garant: Garant | null) => void;
  hasGarant: boolean;
  onHasGarantChange: (hasGarant: boolean) => void;
}

const garantieTypes = [
  { value: "personne_physique", label: "Caution personne physique", icon: UserCheck },
  { value: "personne_morale", label: "Caution personne morale", icon: Building2 },
  { value: "visale", label: "Garantie Visale", icon: Sparkles },
  { value: "glj", label: "Garantie Loyers Impayés (GLI)", icon: Shield },
];

const defaultGarant: Garant = {
  nom: "",
  prenom: "",
  adresse: "",
  code_postal: "",
  ville: "",
  type_garantie: "personne_physique",
};

export function GarantForm({ garant, onGarantChange, hasGarant, onHasGarantChange }: GarantFormProps) {
  const currentGarant = garant || defaultGarant;

  const handleToggle = (checked: boolean) => {
    onHasGarantChange(checked);
    if (checked && !garant) {
      onGarantChange(defaultGarant);
    } else if (!checked) {
      onGarantChange(null);
    }
  };

  const updateGarant = (field: keyof Garant, value: string) => {
    if (!garant) return;
    onGarantChange({ ...garant, [field]: value });
  };

  return (
    <div className="space-y-4">
      {/* Toggle Garant */}
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-blue-500" />
          <div>
            <p className="font-medium">Ajouter un garant (caution)</p>
            <p className="text-sm text-muted-foreground">
              Une personne ou organisme qui se porte garant du locataire
            </p>
          </div>
        </div>
        <Switch checked={hasGarant} onCheckedChange={handleToggle} />
      </div>

      {/* Formulaire Garant */}
      {hasGarant && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="pt-6 space-y-4">
            {/* Type de garantie */}
            <div className="space-y-2">
              <Label>Type de garantie</Label>
              <Select
                value={currentGarant.type_garantie}
                onValueChange={(value) => updateGarant("type_garantie", value)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {garantieTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <type.icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visale - Juste le numéro */}
            {currentGarant.type_garantie === "visale" && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700 mb-3">
                  <strong>Garantie Visale :</strong> Action Logement couvre les impayés de loyer.
                  Le locataire doit avoir obtenu un visa Visale avant la signature.
                </p>
                <div className="space-y-2">
                  <Label>Numéro de visa Visale (optionnel)</Label>
                  <Input
                    placeholder="Ex: VISALE-2024-XXXXX"
                    className="bg-white"
                  />
                </div>
              </div>
            )}

            {/* GLI - Info seulement */}
            {currentGarant.type_garantie === "glj" && (
              <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                <p className="text-sm text-purple-700">
                  <strong>GLI (Garantie Loyers Impayés) :</strong> Assurance souscrite par le propriétaire.
                  Cette garantie est incompatible avec une caution personne physique.
                </p>
              </div>
            )}

            {/* Personne physique - Formulaire complet */}
            {currentGarant.type_garantie === "personne_physique" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prénom du garant</Label>
                    <Input
                      value={currentGarant.prenom}
                      onChange={(e) => updateGarant("prenom", e.target.value)}
                      placeholder="Jean"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nom du garant</Label>
                    <Input
                      value={currentGarant.nom}
                      onChange={(e) => updateGarant("nom", e.target.value)}
                      placeholder="Dupont"
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Adresse</Label>
                  <Input
                    value={currentGarant.adresse}
                    onChange={(e) => updateGarant("adresse", e.target.value)}
                    placeholder="123 rue de la Paix"
                    className="bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code postal</Label>
                    <Input
                      value={currentGarant.code_postal}
                      onChange={(e) => updateGarant("code_postal", e.target.value)}
                      placeholder="75001"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ville</Label>
                    <Input
                      value={currentGarant.ville}
                      onChange={(e) => updateGarant("ville", e.target.value)}
                      placeholder="Paris"
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email (optionnel)</Label>
                    <Input
                      type="email"
                      value={currentGarant.email || ""}
                      onChange={(e) => updateGarant("email", e.target.value)}
                      placeholder="jean.dupont@email.com"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone (optionnel)</Label>
                    <Input
                      value={currentGarant.telephone || ""}
                      onChange={(e) => updateGarant("telephone", e.target.value)}
                      placeholder="06 12 34 56 78"
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Lien de parenté (optionnel)</Label>
                  <Select
                    value={currentGarant.lien_parente || ""}
                    onValueChange={(value) => updateGarant("lien_parente", value)}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="grand_parent">Grand-parent</SelectItem>
                      <SelectItem value="oncle_tante">Oncle/Tante</SelectItem>
                      <SelectItem value="frere_soeur">Frère/Sœur</SelectItem>
                      <SelectItem value="ami">Ami</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Personne morale - Formulaire entreprise */}
            {currentGarant.type_garantie === "personne_morale" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Raison sociale</Label>
                  <Input
                    value={currentGarant.raison_sociale || ""}
                    onChange={(e) => updateGarant("raison_sociale", e.target.value)}
                    placeholder="Nom de l'entreprise"
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>SIRET</Label>
                  <Input
                    value={currentGarant.siret || ""}
                    onChange={(e) => updateGarant("siret", e.target.value)}
                    placeholder="123 456 789 00012"
                    className="bg-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Adresse du siège</Label>
                  <Input
                    value={currentGarant.adresse}
                    onChange={(e) => updateGarant("adresse", e.target.value)}
                    placeholder="Adresse complète"
                    className="bg-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Code postal</Label>
                    <Input
                      value={currentGarant.code_postal}
                      onChange={(e) => updateGarant("code_postal", e.target.value)}
                      placeholder="75001"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ville</Label>
                    <Input
                      value={currentGarant.ville}
                      onChange={(e) => updateGarant("ville", e.target.value)}
                      placeholder="Paris"
                      className="bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom du représentant</Label>
                    <Input
                      value={currentGarant.nom}
                      onChange={(e) => updateGarant("nom", e.target.value)}
                      placeholder="Nom"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom du représentant</Label>
                    <Input
                      value={currentGarant.prenom}
                      onChange={(e) => updateGarant("prenom", e.target.value)}
                      placeholder="Prénom"
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bouton supprimer */}
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggle(false)}
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
              >
                <X className="h-4 w-4 mr-1" />
                Retirer le garant
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
