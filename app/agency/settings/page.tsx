"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  FileText,
  CreditCard,
  Bell,
  Shield,
  Palette,
  Save,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";

export default function AgencySettingsPage() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast({
      title: "Paramètres enregistrés",
      description: "Vos modifications ont été sauvegardées.",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Paramètres
          </h1>
          <p className="text-muted-foreground mt-1">
            Configuration de votre agence
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </Button>
      </div>

      <Tabs defaultValue="agency" className="space-y-6">
        <TabsList className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm p-1">
          <TabsTrigger value="agency" className="gap-2">
            <Building2 className="w-4 h-4" />
            Agence
          </TabsTrigger>
          <TabsTrigger value="legal" className="gap-2">
            <FileText className="w-4 h-4" />
            Informations légales
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Facturation
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Onglet Agence */}
        <TabsContent value="agency">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Informations de l'agence</CardTitle>
              <CardDescription>
                Informations générales de votre agence
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="raison_sociale">Raison sociale</Label>
                  <Input id="raison_sociale" defaultValue="Gestion Immo Plus SARL" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forme_juridique">Forme juridique</Label>
                  <Select defaultValue="SARL">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SARL">SARL</SelectItem>
                      <SelectItem value="SAS">SAS</SelectItem>
                      <SelectItem value="SASU">SASU</SelectItem>
                      <SelectItem value="EURL">EURL</SelectItem>
                      <SelectItem value="EI">Entreprise Individuelle</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input id="siret" defaultValue="12345678901234" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tva">N° TVA intracommunautaire</Label>
                  <Input id="tva" defaultValue="FR12345678901" />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adresse">Adresse du siège</Label>
                  <Input id="adresse" defaultValue="15 Rue de la Paix, 75001 Paris" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email de contact</Label>
                  <Input id="email" type="email" defaultValue="contact@gestion-immo-plus.fr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input id="telephone" defaultValue="01 23 45 67 89" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input id="website" defaultValue="https://www.gestion-immo-plus.fr" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_defaut">Commission par défaut (%)</Label>
                  <Input id="commission_defaut" type="number" defaultValue="7" min="0" max="15" step="0.5" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description de l'agence</Label>
                <Textarea
                  id="description"
                  rows={4}
                  defaultValue="Spécialiste de la gestion locative depuis 2010, nous accompagnons les propriétaires dans la gestion de leur patrimoine immobilier en Île-de-France."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Légal */}
        <TabsContent value="legal">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Carte professionnelle & Garanties</CardTitle>
              <CardDescription>
                Informations réglementaires obligatoires (Loi Hoguet)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Important :</strong> Ces informations doivent être conformes à la réglementation Loi Hoguet
                  et affichées sur tous vos documents officiels.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="carte_pro">N° Carte professionnelle</Label>
                  <Input id="carte_pro" defaultValue="CPI 7501 2024 000 012 345" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carte_pro_cci">Délivrée par</Label>
                  <Input id="carte_pro_cci" defaultValue="CCI Paris Île-de-France" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carte_pro_validite">Date de validité</Label>
                  <Input id="carte_pro_validite" type="date" defaultValue="2027-12-31" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garantie_montant">Garantie financière (€)</Label>
                  <Input id="garantie_montant" type="number" defaultValue="110000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garantie_organisme">Organisme garant</Label>
                  <Input id="garantie_organisme" defaultValue="GALIAN" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assurance_rcp">N° Police RCP</Label>
                  <Input id="assurance_rcp" defaultValue="POL-2024-123456" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assurance_organisme">Assureur RCP</Label>
                  <Input id="assurance_organisme" defaultValue="AXA Assurances" />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Facturation */}
        <TabsContent value="billing">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Paramètres de facturation</CardTitle>
              <CardDescription>
                Configuration de vos honoraires et factures
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="taux_tva">Taux de TVA (%)</Label>
                  <Input id="taux_tva" type="number" defaultValue="20" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="iban">IBAN</Label>
                  <Input id="iban" defaultValue="FR76 3000 4000 0500 0000 0123 456" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="honoraires_location">Honoraires mise en location (€)</Label>
                  <Input id="honoraires_location" type="number" defaultValue="1200" />
                  <p className="text-xs text-muted-foreground">Montant facturé pour trouver un locataire</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="honoraires_edl">Honoraires EDL (€)</Label>
                  <Input id="honoraires_edl" type="number" defaultValue="150" />
                  <p className="text-xs text-muted-foreground">Par état des lieux</p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t">
                <h4 className="font-medium">Options de facturation</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Facturation automatique</p>
                      <p className="text-sm text-muted-foreground">
                        Générer automatiquement les factures de commission
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Envoi automatique par email</p>
                      <p className="text-sm text-muted-foreground">
                        Envoyer les factures aux propriétaires
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Onglet Notifications */}
        <TabsContent value="notifications">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Préférences de notifications</CardTitle>
              <CardDescription>
                Gérez les alertes et notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Nouveau paiement reçu</p>
                    <p className="text-sm text-muted-foreground">
                      Notification lors de l'encaissement d'un loyer
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Loyer impayé</p>
                    <p className="text-sm text-muted-foreground">
                      Alerte en cas de retard de paiement
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Nouveau ticket maintenance</p>
                    <p className="text-sm text-muted-foreground">
                      Notification pour les demandes d'intervention
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Fin de bail proche</p>
                    <p className="text-sm text-muted-foreground">
                      Alerte 3 mois avant la fin d'un bail
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">Rapport mensuel</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un récapitulatif mensuel par email
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

