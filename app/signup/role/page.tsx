"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import {
  Home,
  Users,
  Wrench,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  Bot,
  Sparkles,
  Building2,
} from "lucide-react";

export default function RoleChoicePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [codeLoading, setCodeLoading] = useState(false);
  const [propertyCode, setPropertyCode] = useState("");
  const [selectedRole, setSelectedRole] = useState<"owner" | "tenant" | "provider" | "guarantor" | null>(null);

  // Vérifier si on a un token d'invitation (rôle verrouillé)
  const inviteToken = searchParams.get("invite");
  const lockedRole = searchParams.get("role");

  useEffect(() => {
    // Si on a un token d'invitation, on peut sauter cette étape
    if (inviteToken && lockedRole) {
      router.push(`/signup/account?invite=${inviteToken}&role=${lockedRole}`);
    }
  }, [inviteToken, lockedRole, router]);

  const handleRoleChoice = async (
    role: "owner" | "tenant" | "provider" | "guarantor",
    options?: { propertyCode?: string }
  ) => {
    setLoading(true);
    try {
      if (typeof window !== "undefined") {
        const draft = {
          step: "role_choice",
          data: {
            role,
            propertyCode: options?.propertyCode,
          },
          role,
          timestamp: new Date().toISOString(),
        };
        localStorage.setItem("onboarding_draft", JSON.stringify(draft));
      }

      const params = new URLSearchParams();
      params.set("role", role);
      if (inviteToken) {
        params.set("invite", inviteToken);
      }
      if (options?.propertyCode) {
        params.set("code", options.propertyCode);
      }
      router.push(`/signup/account?${params.toString()}`);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async () => {
    if (!propertyCode.trim()) {
      toast({
        title: "Code requis",
        description: "Saisissez un code logement valide.",
        variant: "destructive",
      });
      return;
    }

    setCodeLoading(true);
    try {
      const response = await fetch(`/api/public/property-code/verify?code=${encodeURIComponent(propertyCode.trim())}`);
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Code invalide ou expiré.");
      }

      toast({
        title: "Code reconnu",
        description: "Vous allez poursuivre l'inscription en tant que locataire.",
      });

      await handleRoleChoice("tenant", { propertyCode: propertyCode.trim() });
    } catch (error: unknown) {
      toast({
        title: "Code introuvable",
        description: error instanceof Error ? error.message : "Nous n'avons pas trouvé ce code logement.",
        variant: "destructive",
      });
    } finally {
      setCodeLoading(false);
    }
  };

  const roleOptions = [
    {
      role: "owner" as const,
      title: "Propriétaire",
      pitch: "Je pilote un portefeuille (LLD, STR, Commerces).",
      highlight: "Recommandé",
      icon: Home,
      features: [
        "Gestion multi-portefeuilles",
        "Automatisation turnovers & IRL",
        "Assistant juridique IA",
        "Encaissement & signature en 1 clic",
      ],
      gradient: "from-indigo-400/25 via-indigo-500/10 to-transparent",
    },
    {
      role: "tenant" as const,
      title: "Locataire / Coloc",
      pitch: "Je suis locataire d’un bien.",
      icon: Users,
      features: ["Accès docs instantané", "Paiements en ligne", "SAV maintenance 24/7", "Codes d'accès sécurisés"],
      gradient: "from-cyan-300/30 via-cyan-400/10 to-transparent",
    },
    {
      role: "provider" as const,
      title: "Prestataire",
      pitch: "Je propose mes services.",
      icon: Wrench,
      features: ["Planning interventions", "Facturation automatique", "Suivi temps réel", "Paiements sécurisés"],
      gradient: "from-emerald-300/30 via-emerald-400/10 to-transparent",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 opacity-50">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(129,140,248,0.2),_transparent_55%)]" />
      </div>
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 px-4 pb-16 pt-16">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          <Badge className="bg-white/10 text-white backdrop-blur">Étape 1 / 3 – Sélectionnez votre expérience</Badge>
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl font-semibold tracking-tight">Bienvenue sur Talok 👋</h1>
            <Sparkles className="h-6 w-6 text-indigo-200" />
          </div>
          <p className="text-lg text-slate-200">
            Choisissez votre profil pour débloquer un parcours personnalisé avec assistants IA, automatisations et
            support premium.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {roleOptions.map((option, index) => {
            const Icon = option.icon;
            const isActive = selectedRole === option.role;
            return (
              <motion.div
                key={option.role}
                initial={{ opacity: 0, y: 25 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08, type: "spring", stiffness: 120 }}
                onMouseEnter={() => setSelectedRole(option.role)}
                onFocus={() => setSelectedRole(option.role)}
              >
                <Card
                  className={`relative h-full overflow-hidden border border-white/10 bg-white/5 p-4 text-white shadow-2xl backdrop-blur transition-all duration-300 ${
                    isActive ? "ring-2 ring-indigo-400" : "hover:-translate-y-1 hover:ring-1 hover:ring-white/40"
                  }`}
                >
                  <div className={`pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br ${option.gradient}`} />
                  <div className="relative flex h-full flex-col gap-6">
                    <CardHeader className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                          <Icon className="h-6 w-6" />
                        </div>
                        {option.highlight && (
                          <Badge className="bg-white/20 text-white backdrop-blur">{option.highlight}</Badge>
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-2xl">{option.title}</CardTitle>
                        <CardDescription className="text-base text-slate-200">{option.pitch}</CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="flex flex-1 flex-col justify-between gap-6">
                      <ul className="space-y-2 text-sm text-slate-100">
                        {option.features.map((feature) => (
                          <li key={feature} className="flex items-center gap-2">
                            <span className="text-emerald-300">→</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                      <Button
                        onClick={() => handleRoleChoice(option.role)}
                        disabled={loading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white text-slate-900 hover:bg-slate-100"
                      >
                        Commencer
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </Button>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <ShieldCheck className="h-5 w-5 text-indigo-200" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Garant ? Utilisez votre lien sécurisé.</h3>
                <p className="text-sm text-slate-200">
                  Pour protéger vos données, l’inscription garant est uniquement accessible via invitation propriétaire.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="rounded-xl border border-white/30 text-white hover:bg-white/10"
              onClick={() => {
                if (!inviteToken) {
                  toast({
                    title: "Invitation requise",
                    description: "Demandez au propriétaire de vous inviter pour continuer.",
                    variant: "destructive",
                  });
                  return;
                }
                handleRoleChoice("guarantor");
              }}
              disabled={loading || (!inviteToken && lockedRole !== "guarantor")}
            >
              {inviteToken ? "Continuer comme garant" : "Invitation requise"}
            </Button>
          </div>
        </motion.div>

        <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <KeyRound className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Vous avez un code logement ?</h3>
                <p className="text-sm text-slate-200">
                  Entrez-le pour rejoindre un dossier locatif en quelques secondes.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
              <input
                type="text"
                placeholder="Ex: PROP-XXXX-XXXX"
                value={propertyCode}
                onChange={(e) => setPropertyCode(e.target.value.toUpperCase())}
                disabled={codeLoading || loading}
                className="w-full rounded-xl border border-white/20 bg-transparent px-4 py-2 text-sm placeholder:text-white/40 focus:border-white focus:outline-none md:w-64"
              />
              <Button
                onClick={handleCodeSubmit}
                disabled={codeLoading || loading}
                className="rounded-xl bg-white text-slate-900 hover:bg-slate-100"
              >
                {codeLoading ? "Vérification..." : "Utiliser ce code"}
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <Bot className="h-5 w-5 text-cyan-200" />
              </div>
              <div>
                <h4 className="font-semibold">Concierge onboarding</h4>
                <p className="text-sm text-slate-200">Besoin d’aide ? Réponse sous 5 min.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              <a href="mailto:support@talok.fr" className="flex items-center justify-between hover:underline">
                support@talok.fr
                <ArrowRight className="h-4 w-4" />
              </a>
              <a href="https://calendly.com/" target="_blank" className="flex items-center justify-between hover:underline">
                Planifier un appel onboarding
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col items-center gap-3 text-sm text-slate-200">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span>Déjà inscrit ?</span>
            <a href="/auth/signin" className="text-white underline-offset-4 hover:underline">
              Se connecter
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

