"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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

  // Charger le profil
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      try {
        const response = await fetch("/api/me/profile");
        if (response.ok) {
          const data = await response.json();
          setProfile({
            prenom: data.prenom || "",
            nom: data.nom || "",
            email: data.email || "",
            telephone: data.telephone || "",
            adresse: data.adresse || "",
            siret: data.siret || "",
            description: data.description || "",
            zones_intervention: data.zones_intervention || [],
            services: data.services || [],
          });
        }
      } catch (error) {
        console.error("Erreur chargement profil:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/me/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!response.ok) throw new Error("Erreur sauvegarde");

      toast({
        title: "Paramètres sauvegardés",
        description: "Vos modifications ont été enregistrées.",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les paramètres.",
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
            <Card className="bg-white/80 backdrop-blur-sm">
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
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nom">Nom</Label>
                    <Input
                      id="nom"
                      value={profile.nom}
                      onChange={(e) => setProfile({ ...profile, nom: e.target.value })}
                      className="bg-white"
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
                      onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                      className="bg-white"
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
                      className="bg-white"
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
                    className="bg-white"
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
                    className="bg-white"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Activité */}
          <motion.div variants={itemVariants}>
            <Card className="bg-white/80 backdrop-blur-sm">
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
                    className="bg-white resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Services proposés</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Plomberie", "Électricité", "Serrurerie", "Chauffage", "Climatisation", "Peinture", "Menuiserie"].map(
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

          {/* Notifications */}
          <motion.div variants={itemVariants}>
            <Card className="bg-white/80 backdrop-blur-sm">
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
        </div>
      </div>
    </motion.div>
  );
}

