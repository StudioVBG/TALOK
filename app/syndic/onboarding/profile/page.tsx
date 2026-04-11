"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  User,
  Building2,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  Loader2,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Validation SIRET : 14 chiffres
const SIRET_REGEX = /^\d{14}$/;

type SyndicType = "professionnel" | "benevole" | "cooperatif";

interface SyndicProfileForm {
  raison_sociale: string;
  forme_juridique: string;
  siret: string;
  type_syndic: SyndicType;
  numero_carte_pro: string;
  carte_pro_delivree_par: string;
  carte_pro_validite: string;
  garantie_financiere_montant: string;
  garantie_financiere_organisme: string;
  assurance_rcp: string;
  assurance_rcp_organisme: string;
  adresse_siege: string;
  code_postal: string;
  ville: string;
  telephone: string;
  email_contact: string;
  contact_name: string;
}

const INITIAL_FORM: SyndicProfileForm = {
  raison_sociale: "",
  forme_juridique: "",
  siret: "",
  type_syndic: "professionnel",
  numero_carte_pro: "",
  carte_pro_delivree_par: "",
  carte_pro_validite: "",
  garantie_financiere_montant: "",
  garantie_financiere_organisme: "",
  assurance_rcp: "",
  assurance_rcp_organisme: "",
  adresse_siege: "",
  code_postal: "",
  ville: "",
  telephone: "",
  email_contact: "",
  contact_name: "",
};

export default function SyndicOnboardingProfilePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<SyndicProfileForm>(INITIAL_FORM);

  const isProfessionnel = form.type_syndic === "professionnel";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation de base
    if (!form.raison_sociale || !form.email_contact) {
      toast({
        title: "Champs requis",
        description: "Raison sociale et email de contact sont obligatoires.",
        variant: "destructive",
      });
      return;
    }

    // Validation SIRET si fourni
    if (form.siret && !SIRET_REGEX.test(form.siret.replace(/\s/g, ""))) {
      toast({
        title: "SIRET invalide",
        description: "Le SIRET doit comporter 14 chiffres.",
        variant: "destructive",
      });
      return;
    }

    // Validation réglementaire pour les syndics professionnels
    if (isProfessionnel) {
      if (!form.numero_carte_pro) {
        toast({
          title: "Carte professionnelle requise",
          description: "Le numéro de carte pro est obligatoire pour un syndic professionnel (loi Hoguet).",
          variant: "destructive",
        });
        return;
      }
      if (!form.garantie_financiere_montant || !form.garantie_financiere_organisme) {
        toast({
          title: "Garantie financière requise",
          description: "La garantie financière est obligatoire pour un syndic professionnel.",
          variant: "destructive",
        });
        return;
      }
      if (!form.assurance_rcp) {
        toast({
          title: "Assurance RCP requise",
          description: "L'assurance RCP est obligatoire.",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);
    try {
      // 1. Mettre à jour le profil de base (prenom, nom, telephone)
      const nameParts = form.contact_name.trim().split(/\s+/);
      const prenom = nameParts[0] || "";
      const nom = nameParts.slice(1).join(" ") || "";

      const profileUpdate: Record<string, string> = {};
      if (prenom) profileUpdate.prenom = prenom;
      if (nom) profileUpdate.nom = nom;
      if (form.telephone) profileUpdate.telephone = form.telephone;

      if (Object.keys(profileUpdate).length > 0) {
        const profileResponse = await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileUpdate),
        });
        if (!profileResponse.ok) throw new Error("Erreur sauvegarde profil");
      }

      // 2. Mettre à jour le profil syndic spécialisé
      const syndicPayload = {
        raison_sociale: form.raison_sociale,
        forme_juridique: form.forme_juridique || null,
        siret: form.siret ? form.siret.replace(/\s/g, "") : null,
        type_syndic: form.type_syndic,
        numero_carte_pro: form.numero_carte_pro || null,
        carte_pro_delivree_par: form.carte_pro_delivree_par || null,
        carte_pro_validite: form.carte_pro_validite || null,
        garantie_financiere_montant: form.garantie_financiere_montant
          ? parseFloat(form.garantie_financiere_montant)
          : null,
        garantie_financiere_organisme: form.garantie_financiere_organisme || null,
        assurance_rcp: form.assurance_rcp || null,
        assurance_rcp_organisme: form.assurance_rcp_organisme || null,
        adresse_siege: form.adresse_siege || null,
        code_postal: form.code_postal || null,
        ville: form.ville || null,
        telephone: form.telephone || null,
        email_contact: form.email_contact,
      };

      const syndicResponse = await fetch("/api/me/syndic-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(syndicPayload),
      });

      if (!syndicResponse.ok) {
        // Fallback : sauvegarder en localStorage si l'endpoint n'est pas encore déployé
        if (typeof window !== "undefined") {
          localStorage.setItem("syndic_profile", JSON.stringify(syndicPayload));
        }
      }

      toast({
        title: "Profil enregistré",
        description: "Passons à l'étape suivante.",
      });

      router.push("/syndic/onboarding/site");
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le profil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-50 p-6"
    >
      <div className="max-w-2xl mx-auto">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">Étape 1 sur 4</span>
            <span className="text-sm font-medium text-indigo-600">25%</span>
          </div>
          <Progress value={25} className="h-2" />
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 mb-4">
            <User className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Bienvenue sur Talok
          </h1>
          <p className="text-muted-foreground mt-2">
            Commençons par configurer votre profil de syndic
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Informations du cabinet
            </CardTitle>
            <CardDescription>
              Ces informations apparaîtront sur vos documents officiels (convocations, PV, appels de fonds).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Type de syndic */}
              <div className="space-y-2">
                <Label htmlFor="type_syndic">Type de syndic *</Label>
                <Select
                  value={form.type_syndic}
                  onValueChange={(value: SyndicType) => setForm({ ...form, type_syndic: value })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professionnel">Syndic professionnel (loi Hoguet)</SelectItem>
                    <SelectItem value="benevole">Syndic bénévole</SelectItem>
                    <SelectItem value="cooperatif">Syndic coopératif</SelectItem>
                  </SelectContent>
                </Select>
                {isProfessionnel && (
                  <p className="text-xs text-amber-600">
                    Syndic professionnel : carte pro, garantie financière et assurance RCP obligatoires.
                  </p>
                )}
              </div>

              {/* Raison sociale */}
              <div className="space-y-2">
                <Label htmlFor="raison_sociale">Raison sociale *</Label>
                <Input
                  id="raison_sociale"
                  value={form.raison_sociale}
                  onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })}
                  placeholder="Cabinet de Syndic ABC"
                  className="bg-white"
                  required
                />
              </div>

              {/* Forme juridique + SIRET */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="forme_juridique">Forme juridique</Label>
                  <Select
                    value={form.forme_juridique}
                    onValueChange={(value) => setForm({ ...form, forme_juridique: value })}
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SARL">SARL</SelectItem>
                      <SelectItem value="SAS">SAS</SelectItem>
                      <SelectItem value="SASU">SASU</SelectItem>
                      <SelectItem value="EURL">EURL</SelectItem>
                      <SelectItem value="SA">SA</SelectItem>
                      <SelectItem value="EI">EI</SelectItem>
                      <SelectItem value="association">Association</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET (14 chiffres)</Label>
                  <Input
                    id="siret"
                    value={form.siret}
                    onChange={(e) => setForm({ ...form, siret: e.target.value.replace(/\s/g, "") })}
                    placeholder="12345678900012"
                    maxLength={14}
                    pattern="\d{14}"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Champs réglementaires loi Hoguet (uniquement pour professionnels) */}
              {isProfessionnel && (
                <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5 space-y-4">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold">
                    <ShieldCheck className="h-5 w-5" />
                    Obligations loi Hoguet
                  </div>

                  {/* Carte professionnelle */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-700 flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Carte professionnelle
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="numero_carte_pro" className="text-xs">N° carte pro *</Label>
                        <Input
                          id="numero_carte_pro"
                          value={form.numero_carte_pro}
                          onChange={(e) => setForm({ ...form, numero_carte_pro: e.target.value })}
                          placeholder="CPI 7501 2020 000 000 000"
                          className="bg-white"
                          required={isProfessionnel}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="carte_pro_delivree_par" className="text-xs">Délivrée par</Label>
                        <Input
                          id="carte_pro_delivree_par"
                          value={form.carte_pro_delivree_par}
                          onChange={(e) => setForm({ ...form, carte_pro_delivree_par: e.target.value })}
                          placeholder="CCI de Paris"
                          className="bg-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="carte_pro_validite" className="text-xs">Validité</Label>
                        <Input
                          id="carte_pro_validite"
                          type="date"
                          value={form.carte_pro_validite}
                          onChange={(e) => setForm({ ...form, carte_pro_validite: e.target.value })}
                          className="bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Garantie financière */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Garantie financière</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="garantie_financiere_montant" className="text-xs">Montant (€) *</Label>
                        <Input
                          id="garantie_financiere_montant"
                          type="number"
                          value={form.garantie_financiere_montant}
                          onChange={(e) => setForm({ ...form, garantie_financiere_montant: e.target.value })}
                          placeholder="120000"
                          className="bg-white"
                          required={isProfessionnel}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="garantie_financiere_organisme" className="text-xs">Organisme *</Label>
                        <Input
                          id="garantie_financiere_organisme"
                          value={form.garantie_financiere_organisme}
                          onChange={(e) => setForm({ ...form, garantie_financiere_organisme: e.target.value })}
                          placeholder="CEGC, Galian, etc."
                          className="bg-white"
                          required={isProfessionnel}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Assurance RCP */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-slate-700">Assurance RCP</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="assurance_rcp" className="text-xs">N° police *</Label>
                        <Input
                          id="assurance_rcp"
                          value={form.assurance_rcp}
                          onChange={(e) => setForm({ ...form, assurance_rcp: e.target.value })}
                          placeholder="RCP-2026-XXXXXX"
                          className="bg-white"
                          required={isProfessionnel}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="assurance_rcp_organisme" className="text-xs">Assureur</Label>
                        <Input
                          id="assurance_rcp_organisme"
                          value={form.assurance_rcp_organisme}
                          onChange={(e) => setForm({ ...form, assurance_rcp_organisme: e.target.value })}
                          placeholder="MMA, AXA, etc."
                          className="bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Contact principal */}
              <div className="space-y-2">
                <Label htmlFor="contact_name">Nom du contact principal</Label>
                <Input
                  id="contact_name"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  placeholder="Jean Dupont"
                  className="bg-white"
                />
              </div>

              {/* Email et Téléphone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email_contact" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email *
                  </Label>
                  <Input
                    id="email_contact"
                    type="email"
                    value={form.email_contact}
                    onChange={(e) => setForm({ ...form, email_contact: e.target.value })}
                    placeholder="contact@cabinet-syndic.fr"
                    className="bg-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Téléphone
                  </Label>
                  <Input
                    id="telephone"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    placeholder="01 23 45 67 89"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Adresse */}
              <div className="space-y-2">
                <Label htmlFor="adresse_siege" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Adresse du siège
                </Label>
                <Input
                  id="adresse_siege"
                  value={form.adresse_siege}
                  onChange={(e) => setForm({ ...form, adresse_siege: e.target.value })}
                  placeholder="123 rue du Syndic"
                  className="bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code_postal">Code postal</Label>
                  <Input
                    id="code_postal"
                    value={form.code_postal}
                    onChange={(e) => setForm({ ...form, code_postal: e.target.value })}
                    placeholder="75001"
                    maxLength={5}
                    className="bg-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ville">Ville</Label>
                  <Input
                    id="ville"
                    value={form.ville}
                    onChange={(e) => setForm({ ...form, ville: e.target.value })}
                    placeholder="Paris"
                    className="bg-white"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end pt-4">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    <>
                      Continuer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

