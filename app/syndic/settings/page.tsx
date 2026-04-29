"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";
import Link from "next/link";
import {
  Building2,
  CreditCard,
  Shield,
  Bell,
  Save,
  Loader2,
  ArrowRight,
} from "lucide-react";

type SyndicType = "professionnel" | "benevole" | "cooperatif";

interface SyndicForm {
  raison_sociale: string;
  forme_juridique: string;
  type_syndic: SyndicType;
  siret: string;
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
  website: string;
}

const EMPTY_FORM: SyndicForm = {
  raison_sociale: "",
  forme_juridique: "",
  type_syndic: "professionnel",
  siret: "",
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
  website: "",
};

export default function SyndicSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [form, setForm] = useState<SyndicForm>(EMPTY_FORM);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/me/syndic-profile");
        if (!res.ok) return;
        const { data } = await res.json();
        if (cancelled || !data) return;
        setForm({
          raison_sociale: data.raison_sociale ?? "",
          forme_juridique: data.forme_juridique ?? "",
          type_syndic: (data.type_syndic ?? "professionnel") as SyndicType,
          siret: data.siret ?? "",
          numero_carte_pro: data.numero_carte_pro ?? "",
          carte_pro_delivree_par: data.carte_pro_delivree_par ?? "",
          carte_pro_validite: data.carte_pro_validite ?? "",
          garantie_financiere_montant:
            data.garantie_financiere_montant != null ? String(data.garantie_financiere_montant) : "",
          garantie_financiere_organisme: data.garantie_financiere_organisme ?? "",
          assurance_rcp: data.assurance_rcp ?? "",
          assurance_rcp_organisme: data.assurance_rcp_organisme ?? "",
          adresse_siege: data.adresse_siege ?? "",
          code_postal: data.code_postal ?? "",
          ville: data.ville ?? "",
          telephone: data.telephone ?? "",
          email_contact: data.email_contact ?? "",
          website: data.website ?? "",
        });
      } finally {
        if (!cancelled) setInitializing(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        raison_sociale: form.raison_sociale,
        type_syndic: form.type_syndic,
        forme_juridique: form.forme_juridique || null,
        siret: form.siret || null,
        numero_carte_pro: form.numero_carte_pro || null,
        carte_pro_delivree_par: form.carte_pro_delivree_par || null,
        carte_pro_validite: form.carte_pro_validite || null,
        garantie_financiere_montant:
          form.garantie_financiere_montant !== ""
            ? Number(form.garantie_financiere_montant)
            : null,
        garantie_financiere_organisme: form.garantie_financiere_organisme || null,
        assurance_rcp: form.assurance_rcp || null,
        assurance_rcp_organisme: form.assurance_rcp_organisme || null,
        adresse_siege: form.adresse_siege || null,
        code_postal: form.code_postal || null,
        ville: form.ville || null,
        telephone: form.telephone || null,
        email_contact: form.email_contact,
        website: form.website || null,
      };

      const res = await fetch("/api/me/syndic-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Erreur de sauvegarde");
      }

      if (form.telephone) {
        await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ telephone: form.telephone }),
        });
      }

      toast({
        title: "Paramètres sauvegardés",
        description: "Vos informations ont été mises à jour.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de sauvegarder.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isProfessional = form.type_syndic === "professionnel";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Paramètres
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez les informations de votre cabinet
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/syndic/settings/subscription">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                  <CreditCard className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Abonnement</p>
                  <p className="text-xs text-muted-foreground">Gérer votre forfait</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings/security">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Sécurité</p>
                  <p className="text-xs text-muted-foreground">Mot de passe, 2FA</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings/notifications">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Notifications</p>
                  <p className="text-xs text-muted-foreground">Alertes et emails</p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-600" />
            Informations du cabinet
          </CardTitle>
          <CardDescription>
            Ces informations apparaissent sur vos documents officiels et sont conservées en base de données.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {initializing ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Chargement…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="raison_sociale">Raison sociale *</Label>
                  <Input
                    id="raison_sociale"
                    required
                    value={form.raison_sociale}
                    onChange={(e) => setForm({ ...form, raison_sociale: e.target.value })}
                    placeholder="Cabinet ABC"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type_syndic">Type de syndic *</Label>
                  <Select
                    value={form.type_syndic}
                    onValueChange={(v) => setForm({ ...form, type_syndic: v as SyndicType })}
                  >
                    <SelectTrigger id="type_syndic">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professionnel">Professionnel</SelectItem>
                      <SelectItem value="benevole">Bénévole</SelectItem>
                      <SelectItem value="cooperatif">Coopératif</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="forme_juridique">Forme juridique</Label>
                  <Select
                    value={form.forme_juridique || "none"}
                    onValueChange={(v) =>
                      setForm({ ...form, forme_juridique: v === "none" ? "" : v })
                    }
                  >
                    <SelectTrigger id="forme_juridique">
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="SARL">SARL</SelectItem>
                      <SelectItem value="SAS">SAS</SelectItem>
                      <SelectItem value="SASU">SASU</SelectItem>
                      <SelectItem value="EURL">EURL</SelectItem>
                      <SelectItem value="SA">SA</SelectItem>
                      <SelectItem value="SCI">SCI</SelectItem>
                      <SelectItem value="EI">EI</SelectItem>
                      <SelectItem value="association">Association</SelectItem>
                      <SelectItem value="benevole">Bénévole</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siret">SIRET (14 chiffres)</Label>
                  <Input
                    id="siret"
                    value={form.siret}
                    onChange={(e) =>
                      setForm({ ...form, siret: e.target.value.replace(/\s/g, "") })
                    }
                    placeholder="12345678900012"
                    maxLength={14}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings_email">Email de contact *</Label>
                  <Input
                    id="settings_email"
                    type="email"
                    required
                    value={form.email_contact}
                    onChange={(e) => setForm({ ...form, email_contact: e.target.value })}
                    placeholder="contact@cabinet.fr"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="settings_phone">Téléphone</Label>
                  <Input
                    id="settings_phone"
                    value={form.telephone}
                    onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                    placeholder="01 23 45 67 89"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="website">Site web</Label>
                  <Input
                    id="website"
                    type="url"
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://www.cabinet.fr"
                  />
                </div>
              </div>

              {isProfessional && (
                <div className="space-y-4 p-4 rounded-lg border border-amber-200 bg-amber-50/40">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">Conformité loi Hoguet</h4>
                    <p className="text-xs text-muted-foreground">
                      Champs requis pour les syndics professionnels.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="carte_pro">N° carte pro G *</Label>
                      <Input
                        id="carte_pro"
                        required={isProfessional}
                        value={form.numero_carte_pro}
                        onChange={(e) =>
                          setForm({ ...form, numero_carte_pro: e.target.value })
                        }
                        placeholder="CPI 7501 2024 000 000 001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carte_pro_delivree">CCI émettrice</Label>
                      <Input
                        id="carte_pro_delivree"
                        value={form.carte_pro_delivree_par}
                        onChange={(e) =>
                          setForm({ ...form, carte_pro_delivree_par: e.target.value })
                        }
                        placeholder="CCI Paris Île-de-France"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carte_pro_validite">Validité jusqu'au</Label>
                      <Input
                        id="carte_pro_validite"
                        type="date"
                        value={form.carte_pro_validite}
                        onChange={(e) =>
                          setForm({ ...form, carte_pro_validite: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="garantie_montant">Garantie financière (€) *</Label>
                      <Input
                        id="garantie_montant"
                        type="number"
                        min={0}
                        step="0.01"
                        required={isProfessional}
                        value={form.garantie_financiere_montant}
                        onChange={(e) =>
                          setForm({ ...form, garantie_financiere_montant: e.target.value })
                        }
                        placeholder="120000"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="garantie_organisme">Organisme garant *</Label>
                      <Input
                        id="garantie_organisme"
                        required={isProfessional}
                        value={form.garantie_financiere_organisme}
                        onChange={(e) =>
                          setForm({ ...form, garantie_financiere_organisme: e.target.value })
                        }
                        placeholder="GALIAN, Socaf, …"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rcp">Police RCP *</Label>
                      <Input
                        id="rcp"
                        required={isProfessional}
                        value={form.assurance_rcp}
                        onChange={(e) => setForm({ ...form, assurance_rcp: e.target.value })}
                        placeholder="Numéro de police"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rcp_organisme">Assureur RCP</Label>
                      <Input
                        id="rcp_organisme"
                        value={form.assurance_rcp_organisme}
                        onChange={(e) =>
                          setForm({ ...form, assurance_rcp_organisme: e.target.value })
                        }
                        placeholder="MMA, AXA, …"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Adresse du siège</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-3 space-y-2">
                    <Label htmlFor="settings_address">Adresse</Label>
                    <Input
                      id="settings_address"
                      value={form.adresse_siege}
                      onChange={(e) => setForm({ ...form, adresse_siege: e.target.value })}
                      placeholder="123 rue du Syndic"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="settings_postal_code">Code postal</Label>
                    <Input
                      id="settings_postal_code"
                      value={form.code_postal}
                      onChange={(e) => setForm({ ...form, code_postal: e.target.value })}
                      placeholder="75001"
                      maxLength={5}
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="settings_city">Ville</Label>
                    <Input
                      id="settings_city"
                      value={form.ville}
                      onChange={(e) => setForm({ ...form, ville: e.target.value })}
                      placeholder="Paris"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-cyan-600 hover:bg-cyan-700"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
