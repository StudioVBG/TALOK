"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  FileText,
  CreditCard,
  Bell,
  Save,
  Loader2,
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
import { ActiveSessionsCard } from "@/components/auth/active-sessions-card";

type FormeJuridique = "SARL" | "SAS" | "SASU" | "SCI" | "EURL" | "EI" | "SA" | "autre";

interface AgencySettingsForm {
  raison_sociale: string;
  forme_juridique: FormeJuridique | "";
  siret: string;
  numero_carte_pro: string;
  carte_pro_delivree_par: string;
  carte_pro_validite: string;
  garantie_financiere_montant: string;
  garantie_financiere_organisme: string;
  assurance_rcp: string;
  assurance_rcp_organisme: string;
  adresse_siege: string;
  website: string;
  description: string;
  commission_gestion_defaut: string;
}

const EMPTY_FORM: AgencySettingsForm = {
  raison_sociale: "",
  forme_juridique: "",
  siret: "",
  numero_carte_pro: "",
  carte_pro_delivree_par: "",
  carte_pro_validite: "",
  garantie_financiere_montant: "",
  garantie_financiere_organisme: "",
  assurance_rcp: "",
  assurance_rcp_organisme: "",
  adresse_siege: "",
  website: "",
  description: "",
  commission_gestion_defaut: "",
};

export default function AgencySettingsPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<AgencySettingsForm>(EMPTY_FORM);
  const [profileExists, setProfileExists] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/agency/profile");
        if (response.status === 404) {
          if (!cancelled) setProfileExists(false);
          return;
        }
        if (!response.ok) {
          throw new Error("Impossible de charger le profil agence");
        }
        const data = await response.json();
        if (cancelled) return;
        if (!data) {
          setProfileExists(false);
          return;
        }
        setProfileExists(true);
        setForm({
          raison_sociale: data.raison_sociale ?? "",
          forme_juridique: (data.forme_juridique ?? "") as FormeJuridique | "",
          siret: data.siret ?? "",
          numero_carte_pro: data.numero_carte_pro ?? "",
          carte_pro_delivree_par: data.carte_pro_delivree_par ?? "",
          carte_pro_validite: data.carte_pro_validite ?? "",
          garantie_financiere_montant:
            data.garantie_financiere_montant != null
              ? String(data.garantie_financiere_montant)
              : "",
          garantie_financiere_organisme: data.garantie_financiere_organisme ?? "",
          assurance_rcp: data.assurance_rcp ?? "",
          assurance_rcp_organisme: data.assurance_rcp_organisme ?? "",
          adresse_siege: data.adresse_siege ?? "",
          website: data.website ?? "",
          description: data.description ?? "",
          commission_gestion_defaut:
            data.commission_gestion_defaut != null
              ? String(data.commission_gestion_defaut)
              : "",
        });
      } catch (error) {
        toast({
          title: "Erreur de chargement",
          description: error instanceof Error ? error.message : "Erreur inconnue",
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const updateField = <K extends keyof AgencySettingsForm>(
    key: K,
    value: AgencySettingsForm[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => {
    const payload: Record<string, unknown> = {
      raison_sociale: form.raison_sociale.trim(),
    };
    if (form.forme_juridique) payload.forme_juridique = form.forme_juridique;
    if (form.siret.trim()) payload.siret = form.siret.trim();
    if (form.numero_carte_pro.trim()) payload.numero_carte_pro = form.numero_carte_pro.trim();
    if (form.carte_pro_delivree_par.trim()) payload.carte_pro_delivree_par = form.carte_pro_delivree_par.trim();
    if (form.carte_pro_validite) payload.carte_pro_validite = form.carte_pro_validite;
    if (form.garantie_financiere_montant) {
      const n = Number(form.garantie_financiere_montant);
      if (!Number.isNaN(n)) payload.garantie_financiere_montant = n;
    }
    if (form.garantie_financiere_organisme.trim()) payload.garantie_financiere_organisme = form.garantie_financiere_organisme.trim();
    if (form.assurance_rcp.trim()) payload.assurance_rcp = form.assurance_rcp.trim();
    if (form.assurance_rcp_organisme.trim()) payload.assurance_rcp_organisme = form.assurance_rcp_organisme.trim();
    if (form.adresse_siege.trim()) payload.adresse_siege = form.adresse_siege.trim();
    if (form.website.trim()) payload.website = form.website.trim();
    if (form.description.trim()) payload.description = form.description.trim();
    if (form.commission_gestion_defaut) {
      const n = Number(form.commission_gestion_defaut);
      if (!Number.isNaN(n)) payload.commission_gestion_defaut = n;
    }
    return payload;
  };

  const handleSave = async () => {
    if (!form.raison_sociale.trim()) {
      toast({
        title: "Raison sociale requise",
        description: "Renseignez la raison sociale de l'agence.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/agency/profile", {
        method: profileExists ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Erreur lors de l'enregistrement");
      }
      setProfileExists(true);
      toast({
        title: "Paramètres enregistrés",
        description: "Vos modifications ont été sauvegardées.",
      });
    } catch (error) {
      toast({
        title: "Échec de l'enregistrement",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Paramètres
          </h1>
          <p className="text-muted-foreground mt-1">
            Configuration de votre agence
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
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
                  <Input
                    id="raison_sociale"
                    value={form.raison_sociale}
                    onChange={(e) => updateField("raison_sociale", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="forme_juridique">Forme juridique</Label>
                  <Select
                    value={form.forme_juridique || undefined}
                    onValueChange={(v) => updateField("forme_juridique", v as FormeJuridique)}
                    disabled={isLoading || isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SARL">SARL</SelectItem>
                      <SelectItem value="SAS">SAS</SelectItem>
                      <SelectItem value="SASU">SASU</SelectItem>
                      <SelectItem value="EURL">EURL</SelectItem>
                      <SelectItem value="SCI">SCI</SelectItem>
                      <SelectItem value="SA">SA</SelectItem>
                      <SelectItem value="EI">Entreprise Individuelle</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET</Label>
                  <Input
                    id="siret"
                    value={form.siret}
                    onChange={(e) => updateField("siret", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="commission_gestion_defaut">Commission par défaut (%)</Label>
                  <Input
                    id="commission_gestion_defaut"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={form.commission_gestion_defaut}
                    onChange={(e) => updateField("commission_gestion_defaut", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="adresse_siege">Adresse du siège</Label>
                  <Input
                    id="adresse_siege"
                    value={form.adresse_siege}
                    onChange={(e) => updateField("adresse_siege", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input
                    id="website"
                    type="url"
                    placeholder="https://..."
                    value={form.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description de l'agence</Label>
                <Textarea
                  id="description"
                  rows={4}
                  value={form.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  disabled={isLoading || isSaving}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legal">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Carte professionnelle &amp; Garanties</CardTitle>
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
                  <Label htmlFor="numero_carte_pro">N° Carte professionnelle</Label>
                  <Input
                    id="numero_carte_pro"
                    value={form.numero_carte_pro}
                    onChange={(e) => updateField("numero_carte_pro", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carte_pro_delivree_par">Délivrée par</Label>
                  <Input
                    id="carte_pro_delivree_par"
                    value={form.carte_pro_delivree_par}
                    onChange={(e) => updateField("carte_pro_delivree_par", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="carte_pro_validite">Date de validité</Label>
                  <Input
                    id="carte_pro_validite"
                    type="date"
                    value={form.carte_pro_validite}
                    onChange={(e) => updateField("carte_pro_validite", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garantie_financiere_montant">Garantie financière (€)</Label>
                  <Input
                    id="garantie_financiere_montant"
                    type="number"
                    min="0"
                    value={form.garantie_financiere_montant}
                    onChange={(e) => updateField("garantie_financiere_montant", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="garantie_financiere_organisme">Organisme garant</Label>
                  <Input
                    id="garantie_financiere_organisme"
                    value={form.garantie_financiere_organisme}
                    onChange={(e) => updateField("garantie_financiere_organisme", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assurance_rcp">N° Police RCP</Label>
                  <Input
                    id="assurance_rcp"
                    value={form.assurance_rcp}
                    onChange={(e) => updateField("assurance_rcp", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assurance_rcp_organisme">Assureur RCP</Label>
                  <Input
                    id="assurance_rcp_organisme"
                    value={form.assurance_rcp_organisme}
                    onChange={(e) => updateField("assurance_rcp_organisme", e.target.value)}
                    disabled={isLoading || isSaving}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Paramètres de facturation</CardTitle>
              <CardDescription>
                Configuration de vos honoraires et factures (bientôt disponible)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 text-sm text-muted-foreground">
                Les paramètres avancés de facturation et d'options de génération seront disponibles prochainement.
                Pour l'instant, configurez votre commission par défaut dans l'onglet « Agence ».
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Préférences de notifications</CardTitle>
              <CardDescription>
                Gérez les alertes et notifications (paramétrage à venir)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 opacity-60">
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Nouveau paiement reçu</p>
                    <p className="text-sm text-muted-foreground">
                      Notification lors de l'encaissement d'un loyer
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3 border-b">
                  <div>
                    <p className="font-medium">Loyer impayé</p>
                    <p className="text-sm text-muted-foreground">
                      Alerte en cas de retard de paiement
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>
                <div className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">Rapport mensuel</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un récapitulatif mensuel par email
                    </p>
                  </div>
                  <Switch disabled defaultChecked />
                </div>
              </div>
              <p className="mt-6 text-xs text-muted-foreground">
                Le paramétrage individuel des notifications sera disponible prochainement.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ActiveSessionsCard />
    </motion.div>
  );
}
