"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, Building2, Shield, CheckCircle2, ArrowLeft } from "lucide-react";
import { ownerProfilesService } from "@/features/profiles/services/owner-profiles.service";
import Link from "next/link";
import { motion } from "framer-motion";

interface BankingFormData {
  iban: string;
  bic: string;
  titulaire_compte: string;
  nom_banque: string;
}

export default function OwnerBankingPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<BankingFormData>({
    iban: "",
    bic: "",
    titulaire_compte: "",
    nom_banque: "",
  });

  useEffect(() => {
    loadBankingInfo();
  }, []);

  const loadBankingInfo = async () => {
    try {
      const profile = await ownerProfilesService.getMyOwnerProfile();
      if (profile) {
        setFormData({
          iban: profile.iban || "",
          bic: (profile as any).bic || "",
          titulaire_compte: (profile as any).titulaire_compte || "",
          nom_banque: (profile as any).nom_banque || "",
        });
      }
    } catch (error) {
      console.error("Erreur chargement profil bancaire:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await ownerProfilesService.updateMyOwnerProfile({
        iban: formData.iban || null,
      } as any);

      toast({
        title: "Coordonnées bancaires enregistrées",
        description: "Vos informations bancaires ont été mises à jour.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les coordonnées bancaires.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatIBAN = (value: string) => {
    // Supprimer tous les espaces et mettre en majuscules
    const cleaned = value.replace(/\s/g, "").toUpperCase();
    // Ajouter un espace tous les 4 caractères
    return cleaned.replace(/(.{4})/g, "$1 ").trim();
  };

  const handleIBANChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatIBAN(e.target.value);
    setFormData({ ...formData, iban: formatted });
  };

  if (loading) {
    return (
      <ProtectedRoute allowedRoles={["owner"]}>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/owner/profile">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Coordonnées bancaires</h1>
            <p className="text-muted-foreground">
              Gérez vos informations bancaires pour recevoir les paiements
            </p>
          </div>
        </div>

        {/* Security Notice */}
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="flex items-start gap-3 py-4">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Vos données sont sécurisées
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Vos coordonnées bancaires sont chiffrées et ne sont utilisées que pour
                le versement de vos loyers.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Banking Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Compte bancaire
            </CardTitle>
            <CardDescription>
              Entrez les coordonnées du compte sur lequel vous souhaitez recevoir les loyers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* IBAN */}
              <div className="space-y-2">
                <Label htmlFor="iban">IBAN *</Label>
                <div className="relative">
                  <Input
                    id="iban"
                    placeholder="FR76 1234 5678 9012 3456 7890 123"
                    value={formData.iban}
                    onChange={handleIBANChange}
                    className="font-mono"
                    maxLength={34}
                  />
                  {formData.iban && formData.iban.length >= 27 && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Format : FR76 XXXX XXXX XXXX XXXX XXXX XXX
                </p>
              </div>

              {/* BIC */}
              <div className="space-y-2">
                <Label htmlFor="bic">BIC / SWIFT (optionnel)</Label>
                <Input
                  id="bic"
                  placeholder="BNPAFRPP"
                  value={formData.bic}
                  onChange={(e) =>
                    setFormData({ ...formData, bic: e.target.value.toUpperCase() })
                  }
                  className="font-mono"
                  maxLength={11}
                />
                <p className="text-xs text-muted-foreground">
                  Code d'identification de votre banque (8 ou 11 caractères)
                </p>
              </div>

              {/* Titulaire */}
              <div className="space-y-2">
                <Label htmlFor="titulaire">Titulaire du compte (optionnel)</Label>
                <Input
                  id="titulaire"
                  placeholder="Jean Dupont"
                  value={formData.titulaire_compte}
                  onChange={(e) =>
                    setFormData({ ...formData, titulaire_compte: e.target.value })
                  }
                />
              </div>

              {/* Nom banque */}
              <div className="space-y-2">
                <Label htmlFor="banque">Nom de la banque (optionnel)</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="banque"
                    placeholder="BNP Paribas"
                    value={formData.nom_banque}
                    onChange={(e) =>
                      setFormData({ ...formData, nom_banque: e.target.value })
                    }
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" asChild>
                  <Link href="/owner/profile">Annuler</Link>
                </Button>
                <Button type="submit" disabled={saving || !formData.iban}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Enregistrement...
                    </>
                  ) : (
                    "Enregistrer"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info additionnelle */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <h3 className="font-medium mb-2">Comment trouver votre IBAN ?</h3>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Sur votre relevé bancaire</li>
              <li>Dans votre espace client en ligne</li>
              <li>Sur votre chéquier (au dos)</li>
              <li>En contactant votre conseiller bancaire</li>
            </ul>
          </CardContent>
        </Card>
      </motion.div>
    </ProtectedRoute>
  );
}

