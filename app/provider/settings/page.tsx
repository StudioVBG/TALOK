"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useProfileQuery } from "@/lib/hooks/use-profile-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Settings,
  User,
  Bell,
  Shield,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  Building2,
  Save,
  Loader2,
  CheckCircle2,
  Briefcase,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ProviderLogoCard } from "@/components/provider/provider-logo-card";
import { ActiveSessionsCard } from "@/components/auth/active-sessions-card";
import { PROVIDER_SERVICES } from "@/lib/constants/provider-services";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export default function ProviderSettingsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({
    prenom: "",
    nom: "",
    email: "",
    telephone: "",
    adresse: "",
    siret: "",
    description: "",
    zones_intervention: [] as string[],
    services: [] as string[],
  });

  const [notifications, setNotifications] = useState({
    email_new_mission: true,
    email_reminder: true,
    push_enabled: false,
    sms_urgent: false,
  });

  // Charger le profil via React Query (cache partagé, pas de duplication)
  const { data: profileData, isLoading: profileLoading } = useProfileQuery();

  // Charger le profil prestataire (siret, adresse, services, etc.) en parallèle
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (profileLoading) {
        setLoading(true);
        return;
      }
      try {
        const res = await fetch("/api/me/provider-profile", { credentials: "include" });
        const providerData = res.ok ? await res.json() : null;
        if (cancelled) return;

        setProfile({
          prenom: profileData?.prenom || "",
          nom: profileData?.nom || "",
          email: (profileData as any)?.email || "",
          telephone: profileData?.telephone || "",
          adresse: providerData?.adresse || "",
          siret: providerData?.siret || "",
          description: providerData?.bio || "",
          zones_intervention: providerData?.zones_intervention
            ? String(providerData.zones_intervention)
                .split(",")
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [],
          services: Array.isArray(providerData?.type_services) ? providerData.type_services : [],
        });
      } catch (err) {
        console.error("[provider/settings] load provider profile failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [profileData, profileLoading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1) Champs liés au compte utilisateur (table profiles) — n'envoyer que les champs non vides
      const profilePayload: Record<string, string> = {};
      if (profile.prenom?.trim()) profilePayload.prenom = profile.prenom.trim();
      if (profile.nom?.trim()) profilePayload.nom = profile.nom.trim();
      if (profile.telephone?.trim()) profilePayload.telephone = profile.telephone.trim();

      if (Object.keys(profilePayload).length > 0) {
        const profileRes = await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(profilePayload),
        });
        if (!profileRes.ok) {
          const err = await profileRes.json().catch(() => ({}));
          throw new Error(err?.error || "Erreur mise à jour du profil");
        }
      }

      // 2) Champs métier prestataire (table provider_profiles)
      const providerPayload = {
        adresse: profile.adresse?.trim() || null,
        siret: profile.siret?.trim() || null,
        bio: profile.description?.trim() || null,
        type_services: profile.services,
        zones_intervention: profile.zones_intervention?.length
          ? profile.zones_intervention.join(", ")
          : null,
      };

      const providerRes = await fetch("/api/me/provider-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(providerPayload),
      });
      if (!providerRes.ok) {
        const err = await providerRes.json().catch(() => ({}));
        throw new Error(err?.error || "Erreur mise à jour du profil prestataire");
      }

      toast({
        title: "Paramètres sauvegardés",
        description: "Vos modifications ont été enregistrées.",
      });
    } catch (error) {
      console.error("[provider/settings] save failed", error);
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de sauvegarder les paramètres.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/20 to-slate-50"
    >
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-orange-900 to-slate-900 bg-clip-text text-transparent">
            Paramètres
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez votre profil et vos préférences
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Profil */}
          <motion.div variants={itemVariants}>
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-orange-500" />
                  Informations personnelles
                </CardTitle>
                <CardDescription>
                  Vos informations de contact et d'identification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prenom">Prénom</Label>
                    <Input
                      id="prenom"
                      value={profile.prenom}
                      onChange={(e) => setProfile({ ...profile, prenom: e.target.value })}
                      className="bg-card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom</Label>
                    <Input
                      id="nom"
                      value={profile.nom}
                      onChange={(e) => setProfile({ ...profile, nom: e.target.value })}
                      className="bg-card"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      readOnly
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telephone" className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Téléphone
                    </Label>
                    <Input
                      id="telephone"
                      value={profile.telephone}
                      onChange={(e) => setProfile({ ...profile, telephone: e.target.value })}
                      className="bg-card"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adresse" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Adresse
                  </Label>
                  <Input
                    id="adresse"
                    value={profile.adresse}
                    onChange={(e) => setProfile({ ...profile, adresse: e.target.value })}
                    placeholder="Votre adresse professionnelle"
                    className="bg-card"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="siret" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    SIRET
                  </Label>
                  <Input
                    id="siret"
                    value={profile.siret}
                    onChange={(e) => setProfile({ ...profile, siret: e.target.value })}
                    placeholder="123 456 789 00012"
                    className="bg-card"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Logo entreprise */}
          <motion.div variants={itemVariants}>
            <ProviderLogoCard />
          </motion.div>

          {/* Activité */}
          <motion.div variants={itemVariants}>
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-orange-500" />
                  Activité professionnelle
                </CardTitle>
                <CardDescription>
                  Décrivez vos services et zones d'intervention
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Description de vos services</Label>
                  <Textarea
                    id="description"
                    value={profile.description}
                    onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                    placeholder="Décrivez votre activité, vos spécialités..."
                    rows={4}
                    className="bg-card resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Services proposés</Label>
                  <div className="flex flex-wrap gap-2">
                    {PROVIDER_SERVICES.map(
                      (service) => (
                        <Badge
                          key={service}
                          variant={profile.services.includes(service) ? "default" : "outline"}
                          className={cn(
                            "cursor-pointer transition-colors",
                            profile.services.includes(service)
                              ? "bg-orange-500 hover:bg-orange-600"
                              : "hover:bg-orange-100"
                          )}
                          onClick={() => {
                            setProfile({
                              ...profile,
                              services: profile.services.includes(service)
                                ? profile.services.filter((s) => s !== service)
                                : [...profile.services, service],
                            });
                          }}
                        >
                          {service}
                        </Badge>
                      )
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Compte de paiement (Stripe Connect) */}
          <motion.div variants={itemVariants}>
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-emerald-500" />
                  Compte de paiement
                </CardTitle>
                <CardDescription>
                  Configurez votre compte bancaire pour recevoir vos paiements
                  d'intervention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/provider/settings/payouts">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Gérer mon compte de paiement
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div variants={itemVariants}>
            <Card className="bg-card/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" />
                  Notifications
                </CardTitle>
                <CardDescription>
                  Configurez vos préférences de notification
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Nouvelles missions</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un email pour chaque nouvelle mission
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email_new_mission}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, email_new_mission: checked })
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Rappels</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir des rappels pour les interventions à venir
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email_reminder}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, email_reminder: checked })
                    }
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">SMS urgents</p>
                    <p className="text-sm text-muted-foreground">
                      Recevoir un SMS pour les interventions urgentes
                    </p>
                  </div>
                  <Switch
                    checked={notifications.sms_urgent}
                    onCheckedChange={(checked) =>
                      setNotifications({ ...notifications, sms_urgent: checked })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Actions */}
          <motion.div variants={itemVariants} className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => router.back()}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Sauvegarder
                </>
              )}
            </Button>
          </motion.div>

          <ActiveSessionsCard />
        </div>
      </div>
    </motion.div>
  );
}

