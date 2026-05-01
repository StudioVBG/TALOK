"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import Link from "next/link";
import { ActiveSessionsCard } from "@/components/auth/active-sessions-card";
import {
  Building2,
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Shield,
  Bell,
  Save,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function SyndicSettingsPage() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    siret: "",
    carte_g: "",
    address: "",
    postal_code: "",
    city: "",
    email: "",
    phone: "",
    contact_name: "",
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("syndic_profile");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setForm((prev) => ({ ...prev, ...parsed }));
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("syndic_profile", JSON.stringify(form));
      }

      const nameParts = form.contact_name.trim().split(/\s+/);
      const prenom = nameParts[0] || "";
      const nom = nameParts.slice(1).join(" ") || "";

      const profileUpdate: Record<string, string> = {};
      if (prenom) profileUpdate.prenom = prenom;
      if (nom) profileUpdate.nom = nom;
      if (form.phone) profileUpdate.telephone = form.phone;

      if (Object.keys(profileUpdate).length > 0) {
        const response = await fetch("/api/me/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profileUpdate),
        });
        if (!response.ok) throw new Error("Erreur sauvegarde");
      }

      toast({
        title: "Parametres sauvegardes",
        description: "Vos informations ont ete mises a jour.",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder les parametres.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground font-[family-name:var(--font-manrope)]">
          Parametres
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerez les informations de votre cabinet
        </p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/syndic/settings/subscription">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/40">
                  <CreditCard className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">
                    Abonnement
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Gerer votre forfait
                  </p>
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
                  <p className="text-sm font-medium text-foreground">
                    Securite
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Mot de passe, 2FA
                  </p>
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
                  <p className="text-sm font-medium text-foreground">
                    Notifications
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Alertes et emails
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Cabinet info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-600" />
            Informations du cabinet
          </CardTitle>
          <CardDescription>
            Ces informations apparaissent sur vos documents officiels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company_name">Nom du cabinet</Label>
                <Input
                  id="company_name"
                  value={form.company_name}
                  onChange={(e) =>
                    setForm({ ...form, company_name: e.target.value })
                  }
                  placeholder="Cabinet de Syndic ABC"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="siret">SIRET</Label>
                <Input
                  id="siret"
                  value={form.siret}
                  onChange={(e) =>
                    setForm({ ...form, siret: e.target.value })
                  }
                  placeholder="123 456 789 00012"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="carte_g">N carte professionnelle G</Label>
                <Input
                  id="carte_g"
                  value={form.carte_g}
                  onChange={(e) =>
                    setForm({ ...form, carte_g: e.target.value })
                  }
                  placeholder="CPI 7501 2024 000 000 001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_name">Contact principal</Label>
                <Input
                  id="contact_name"
                  value={form.contact_name}
                  onChange={(e) =>
                    setForm({ ...form, contact_name: e.target.value })
                  }
                  placeholder="Jean Dupont"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings_email">Email</Label>
                <Input
                  id="settings_email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="contact@cabinet.fr"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="settings_phone">Telephone</Label>
                <Input
                  id="settings_phone"
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value })
                  }
                  placeholder="01 23 45 67 89"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">
                Adresse du cabinet
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-3 space-y-2">
                  <Label htmlFor="settings_address">Adresse</Label>
                  <Input
                    id="settings_address"
                    value={form.address}
                    onChange={(e) =>
                      setForm({ ...form, address: e.target.value })
                    }
                    placeholder="123 rue du Syndic"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="settings_postal_code">Code postal</Label>
                  <Input
                    id="settings_postal_code"
                    value={form.postal_code}
                    onChange={(e) =>
                      setForm({ ...form, postal_code: e.target.value })
                    }
                    placeholder="75001"
                  />
                </div>
                <div className="sm:col-span-2 space-y-2">
                  <Label htmlFor="settings_city">Ville</Label>
                  <Input
                    id="settings_city"
                    value={form.city}
                    onChange={(e) =>
                      setForm({ ...form, city: e.target.value })
                    }
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
        </CardContent>
      </Card>

      <ActiveSessionsCard />
    </div>
  );
}
