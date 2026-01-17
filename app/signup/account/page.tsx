"use client";
// @ts-nocheck

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { authService } from "@/features/auth/services/auth.service";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { accountCreationSchema, consentsSchema, minimalProfileSchema } from "@/lib/validations/onboarding";
import type { UserRole } from "@/lib/types";
import {
  Mail,
  Lock,
  Link as LinkIcon,
  ArrowRight,
  User as UserIcon,
  Phone,
  Shield,
  FileText,
  Cookie,
  CheckCircle2,
} from "lucide-react";
import { PasswordInput } from "@/components/ui/password-input";
import { cn } from "@/lib/utils";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

const TERMS_VERSION = "1.0";
const PRIVACY_VERSION = "1.0";

type AccountDraft = {
  formData: {
    prenom: string;
    nom: string;
    telephone: string;
    phoneCountry: string; // Code pays pour le téléphone (FR, MQ, etc.)
    email: string;
    password: string;
    confirmPassword: string;
  };
  consents: {
    terms_accepted: boolean;
    privacy_accepted: boolean;
    cookies_necessary: boolean;
    cookies_analytics: boolean;
    cookies_ads: boolean;
  };
  skipPhone: boolean;
  useMagicLink: boolean;
};

const INITIAL_DRAFT: AccountDraft = {
  formData: {
    prenom: "",
    nom: "",
    telephone: "",
    phoneCountry: "FR", // Par défaut France
    email: "",
    password: "",
    confirmPassword: "",
  },
  consents: {
    terms_accepted: false,
    privacy_accepted: false,
    cookies_necessary: true,
    cookies_analytics: false,
    cookies_ads: false,
  },
  skipPhone: false,
  useMagicLink: false,
};

export default function AccountCreationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [lastAutosave, setLastAutosave] = useState<Date | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const role = searchParams.get("role") as UserRole | null;
  const inviteToken = searchParams.get("invite");
  const propertyCode = searchParams.get("code");

  const [draft, setDraft] = useState<AccountDraft>(INITIAL_DRAFT);

  useEffect(() => {
    if (!role || !["owner", "tenant", "provider", "guarantor"].includes(role)) {
      router.push("/signup/role");
    }
  }, [role, router]);

  useEffect(() => {
    onboardingService.getDraft().then((saved) => {
      if (saved?.data?.accountCreation && typeof saved.data.accountCreation === "object") {
        setDraft((prev) => ({
          ...prev,
          ...(saved.data.accountCreation as any),
        }));
      }
    });
  }, []);

  const roleLabel = useMemo(() => {
    switch (role) {
      case "owner":
        return "propriétaire";
      case "tenant":
        return "locataire";
      case "provider":
        return "prestataire";
      case "guarantor":
        return "garant";
      default:
        return "";
    }
  }, [role]);

  const nextStepByRole: Record<UserRole, string> = {
    owner: "/owner/onboarding/profile",
    tenant: inviteToken ? `/tenant/onboarding/context?invite=${inviteToken}` : "/tenant/onboarding/context",
    provider: "/provider/onboarding/profile",
    guarantor: inviteToken ? `/guarantor/onboarding/context?invite=${inviteToken}` : "/guarantor/onboarding/context",
    admin: "/dashboard",
  };

  // Helper pour sauvegarder en arrière-plan
  const saveDraftInBackground = (nextDraft: AccountDraft) => {
    setAutosaving(true);
    void onboardingService.saveDraft(
      "account_creation",
      {
        accountCreation: nextDraft,
        inviteToken,
        propertyCode,
      },
      role!
    ).then(() => {
      setLastAutosave(new Date());
      setAutosaving(false);
    }).catch(() => {
      setAutosaving(false);
    });
  };

  const autosave = (updated: Partial<AccountDraft>) => {
    // Mettre à jour le state immédiatement pour que les valeurs s'affichent tout de suite
    setDraft((prev) => {
      const nextDraft = {
        ...prev,
        ...updated,
      };
      // Sauvegarder en arrière-plan sans bloquer l'UI
      saveDraftInBackground(nextDraft);
      return nextDraft;
    });
  };

  const updateForm = (key: keyof AccountDraft["formData"], value: string) => {
    // Mettre à jour le state immédiatement pour l'affichage
    setDraft((prev) => {
      const nextDraft = {
        ...prev,
        formData: {
          ...prev.formData,
          [key]: value,
        },
      };
      // Sauvegarder en arrière-plan
      saveDraftInBackground(nextDraft);
      return nextDraft;
    });
  };

  const updateConsent = (key: keyof AccountDraft["consents"], value: boolean) => {
    // Mettre à jour le state immédiatement pour l'affichage
    setDraft((prev) => {
      const nextDraft = {
        ...prev,
        consents: {
          ...prev.consents,
          [key]: value,
        },
      };
      // Sauvegarder en arrière-plan
      saveDraftInBackground(nextDraft);
      return nextDraft;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Utiliser le pays sélectionné pour le téléphone
      const phoneCountry = draft.formData.phoneCountry || "FR";
      const minimalValidated = minimalProfileSchema.parse({
        prenom: draft.formData.prenom,
        nom: draft.formData.nom,
        country_code: phoneCountry as "FR" | "GP" | "MQ" | "GF" | "RE" | "YT" | "PM" | "BL" | "MF",
        telephone: draft.skipPhone ? null : (draft.formData.telephone?.trim() || null),
      });

      const validatedConsents = consentsSchema.parse({
        ...draft.consents,
        terms_version: TERMS_VERSION,
        privacy_version: PRIVACY_VERSION,
      });

      const validated = accountCreationSchema.parse({
        prenom: minimalValidated.prenom,
        nom: minimalValidated.nom,
        email: draft.formData.email,
        password: draft.useMagicLink ? undefined : draft.formData.password,
        useMagicLink: draft.useMagicLink,
        accept_cgu: validatedConsents.terms_accepted,
        accept_privacy: validatedConsents.privacy_accepted,
      });

      if (!draft.useMagicLink && draft.formData.password !== draft.formData.confirmPassword) {
        toast({
          title: "Mot de passe",
          description: "Les mots de passe ne correspondent pas.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (draft.useMagicLink) {
        await authService.sendMagicLink(validated.email);
        setEmailSent(true);
        toast({
          title: "Lien magique envoyé",
          description: "Vérifiez votre email pour vous connecter.",
        });
        await autosave({
          formData: {
            ...draft.formData,
            email: validated.email,
          },
          consents: validatedConsents,
        });
        router.push(
          `/signup/verify-email?email=${encodeURIComponent(validated.email)}&magic=true${role ? `&role=${role}` : ""}`
        );
      } else {
        await authService.signUp({
          email: validated.email,
          password: draft.formData.password,
          role: role!,
          prenom: minimalValidated.prenom,
          nom: minimalValidated.nom,
          telephone: minimalValidated.telephone || undefined,
        });

        await autosave({
          formData: {
            ...draft.formData,
            email: validated.email,
          },
          consents: validatedConsents,
        });

        toast({
          title: "Compte créé",
          description: "Un email de vérification a été envoyé.",
        });

        router.push(`/signup/verify-email?email=${encodeURIComponent(validated.email)}${role ? `&role=${role}` : ""}`);
      }
    } catch (error: unknown) {
      const message = error.message?.toLowerCase() || "";

      if (message.includes("already registered") || message.includes("already exists") || error.code === "PGRST301") {
        toast({
          title: "Email déjà utilisé",
          description: "Connexion ou réinitialisation nécessaire.",
          variant: "destructive",
        });
      } else if (message.includes("rate limit") || error.status === 429) {
        toast({
          title: "Trop de tentatives",
          description: "Veuillez patienter avant de réessayer.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Impossible de créer le compte.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingShell
      stepLabel="Étape 2 / 3 – Créons votre accès"
      title={`Créons votre compte${roleLabel ? ` ${roleLabel}` : ""}`}
      subtitle="Identité, sécurité et consentements : tout en une seule étape."
      footer={
        <p>
          Déjà inscrit ?{" "}
          <a href="/auth/signin" className="text-white underline-offset-4 hover:underline">
            Se connecter
          </a>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-8 text-white">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 160 }}
          className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-slate-200"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              Autosauvegarde sécurisée
            </span>
            <span className="text-xs text-slate-300">
              {autosaving
                ? "Sauvegarde en cours..."
                : lastAutosave
                ? `Brouillon enregistré à ${lastAutosave.toLocaleTimeString()}`
                : "Autosauvegarde activée"}
            </span>
          </div>
        </motion.div>

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140 }}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-200">
            <UserIcon className="h-4 w-4" />
            Identité & contact
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                placeholder="Prénom"
                value={draft.formData.prenom}
                onChange={(e) => updateForm("prenom", e.target.value)}
                required
                disabled={loading}
                className="text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                placeholder="Nom"
                value={draft.formData.nom}
                onChange={(e) => updateForm("nom", e.target.value)}
                required
                disabled={loading}
                className="text-slate-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telephone">Téléphone mobile</Label>
              <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
                <Select
                  value={draft.formData.phoneCountry}
                  onValueChange={(value: string) => autosave({ formData: { ...draft.formData, phoneCountry: value } })}
                  disabled={loading || draft.skipPhone}
                >
                  <SelectTrigger className="text-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FR">🇫🇷 +33</SelectItem>
                    <SelectItem value="MQ">🇲🇶 +596</SelectItem>
                    <SelectItem value="GP">🇬🇵 +590</SelectItem>
                    <SelectItem value="GF">🇬🇫 +594</SelectItem>
                    <SelectItem value="RE">🇷🇪 +262</SelectItem>
                    <SelectItem value="YT">🇾🇹 +262</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="telephone"
                    placeholder="0696614049"
                    value={draft.formData.telephone}
                    onChange={(e) => updateForm("telephone", e.target.value)}
                    disabled={loading || draft.skipPhone}
                    className="pl-10 text-slate-900"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-300">
                Format : 0696614049 (sera converti en {draft.formData.phoneCountry === "MQ" ? "+596" : draft.formData.phoneCountry === "GP" ? "+590" : draft.formData.phoneCountry === "GF" ? "+594" : draft.formData.phoneCountry === "RE" || draft.formData.phoneCountry === "YT" ? "+262" : "+33"}696614049)
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  id="skipPhone"
                  type="checkbox"
                  checked={draft.skipPhone}
                  onChange={(e) => void autosave({ skipPhone: e.target.checked })}
                  className="rounded border-white/30 bg-transparent"
                  disabled={loading}
                />
                <Label htmlFor="skipPhone" className="cursor-pointer text-xs text-slate-300">
                  Je compléterai mon téléphone plus tard
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@email.com"
                  value={draft.formData.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  required
                  disabled={loading}
                  className="pl-10 text-slate-900"
                />
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, type: "spring", stiffness: 140 }}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-200">
            <Lock className="h-4 w-4" />
            Sécurité d’accès
          </div>
          <div className="rounded-xl border border-white/15 bg-black/10 p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <Label htmlFor="useMagicLink" className="font-medium cursor-pointer">
                  Utiliser un lien magique
                </Label>
                <p className="text-xs text-slate-300">Connexion sans mot de passe via email sécurisé.</p>
              </div>
              <div className="flex items-center gap-2 sm:flex-shrink-0">
                <label htmlFor="useMagicLink" className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs text-slate-300">
                    {draft.useMagicLink ? "Sans mot de passe" : "Mot de passe requis"}
                  </span>
                  <input
                    type="checkbox"
                    id="useMagicLink"
                    checked={draft.useMagicLink}
                    onChange={(e) => void autosave({ useMagicLink: e.target.checked })}
                    disabled={loading}
                    className="h-5 w-5 rounded border-white/30 bg-transparent cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {!draft.useMagicLink ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 z-10 h-4 w-4 text-slate-400" />
                    <PasswordInput
                      id="password"
                      placeholder="Minimum 12 caractères"
                      value={draft.formData.password}
                      onChange={(e) => updateForm("password", e.target.value)}
                      required
                      disabled={loading}
                      className="pl-10 text-slate-900"
                    />
                  </div>
                  <p className="text-xs text-slate-300">
                    12+ caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 caractère spécial
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder="Répétez le mot de passe"
                    value={draft.formData.confirmPassword}
                    onChange={(e) => updateForm("confirmPassword", e.target.value)}
                    required
                    disabled={loading}
                    className="text-slate-900"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-indigo-300/30 bg-indigo-500/10 p-4 text-sm text-indigo-100">
                <p className="font-medium text-white">Connexion sans mot de passe</p>
                <p className="text-white/75">Un lien magique sera envoyé à votre email pour valider votre compte.</p>
              </div>
            )}
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 140 }}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-200">
            <Shield className="h-4 w-4" />
            Consentements légaux
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={cn("rounded-xl border p-4 space-y-2", draft.consents.terms_accepted && "border-emerald-400/70")}>
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 text-indigo-200" />
                <div>
                  <Label htmlFor="terms" className="cursor-pointer font-semibold">
                    J’accepte les{" "}
                    <a href="/legal/terms" target="_blank" className="text-white underline-offset-4 hover:underline">
                      conditions d’utilisation
                    </a>{" "}
                    (v{TERMS_VERSION})
                  </Label>
                  <p className="text-xs text-slate-300">Nécessaire pour utiliser la plateforme.</p>
                </div>
              </div>
              <input
                type="checkbox"
                id="terms"
                checked={draft.consents.terms_accepted}
                onChange={(e) => updateConsent("terms_accepted", e.target.checked)}
                required
                disabled={loading}
                className="h-5 w-5 rounded border-white/30 bg-transparent"
              />
            </div>

            <div className={cn("rounded-xl border p-4 space-y-2", draft.consents.privacy_accepted && "border-emerald-400/70")}>
              <div className="flex items-start gap-3">
                <Shield className="mt-0.5 h-5 w-5 text-indigo-200" />
                <div>
                  <Label htmlFor="privacy" className="cursor-pointer font-semibold">
                    J’accepte la{" "}
                    <a href="/legal/privacy" target="_blank" className="text-white underline-offset-4 hover:underline">
                      politique de confidentialité
                    </a>{" "}
                    (v{PRIVACY_VERSION})
                  </Label>
                  <p className="text-xs text-slate-300">Explique comment vos données sont traitées.</p>
                </div>
              </div>
              <input
                type="checkbox"
                id="privacy"
                checked={draft.consents.privacy_accepted}
                onChange={(e) => updateConsent("privacy_accepted", e.target.checked)}
                required
                disabled={loading}
                className="h-5 w-5 rounded border-white/30 bg-transparent"
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/15 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-200">
              <Cookie className="h-4 w-4 text-indigo-200" />
              Préférences cookies
            </div>
            <div className="grid gap-4 pt-3 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Essentiels</p>
                <p className="text-xs text-slate-300">Toujours actifs pour assurer le fonctionnement.</p>
                <input type="checkbox" checked disabled className="h-5 w-5 rounded border-white/30 bg-transparent" />
              </div>
              <label className="space-y-1 cursor-pointer" htmlFor="cookies_analytics">
                <div className="flex items-center gap-2">
                  <input
                    id="cookies_analytics"
                    type="checkbox"
                    checked={draft.consents.cookies_analytics}
                    onChange={(e) => updateConsent("cookies_analytics", e.target.checked)}
                    disabled={loading}
                    className="h-5 w-5 rounded border-white/30 bg-transparent"
                  />
                  <span className="text-sm font-medium">Analytics</span>
                </div>
                <p className="text-xs text-slate-300">Nous aide à améliorer l’expérience (Matomo, GA).</p>
              </label>
              <label className="space-y-1 cursor-pointer" htmlFor="cookies_ads">
                <div className="flex items-center gap-2">
                  <input
                    id="cookies_ads"
                    type="checkbox"
                    checked={draft.consents.cookies_ads}
                    onChange={(e) => updateConsent("cookies_ads", e.target.checked)}
                    disabled={loading}
                    className="h-5 w-5 rounded border-white/30 bg-transparent"
                  />
                  <span className="text-sm font-medium">Publicitaires</span>
                </div>
                <p className="text-xs text-slate-300">Personnalisation marketing optionnelle.</p>
              </label>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 140 }}
          className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-5"
        >
          {!draft.consents.terms_accepted || !draft.consents.privacy_accepted ? (
            <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-sm text-amber-100">
              Acceptez les CGU et la politique de confidentialité pour continuer.
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Votre compte sera créé et vous accéderez à l’étape suivante.
            </div>
          )}

          <Button
            type="submit"
            disabled={
              loading ||
              !draft.consents.terms_accepted ||
              !draft.consents.privacy_accepted ||
              (!draft.useMagicLink && draft.formData.password.length === 0)
            }
            className="w-full bg-white text-slate-900 hover:bg-white/90"
          >
            {loading ? (
              "Création en cours..."
            ) : draft.useMagicLink ? (
              <>
                <LinkIcon className="mr-2 h-4 w-4" />
                Envoyer le lien magique
              </>
            ) : (
              <>
                Valider mon compte
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
          {emailSent && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              <CheckCircle2 className="h-4 w-4" />
              Lien magique envoyé ! Consultez votre messagerie.
            </div>
          )}
        </motion.div>
      </form>
    </OnboardingShell>
  );
}
