"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { authService } from "@/features/auth/services/auth.service";
import { Mail, RefreshCw, CheckCircle2, ArrowRight } from "lucide-react";
import { OnboardingShell } from "@/components/onboarding/onboarding-shell";

export default function VerifyEmailOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [emailSent, setEmailSent] = useState(false);
  const [verified, setVerified] = useState(false);

  const emailParam = searchParams.get("email");
  const isMagicLink = searchParams.get("magic") === "true";
  const role = searchParams.get("role");

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // Récupérer l'email de l'utilisateur
      authService
        .getUser()
        .then((user) => {
          if (user?.email) {
            setEmail(user.email);
            // Vérifier si l'email est déjà confirmé
            if (user.email_confirmed_at) {
              setVerified(true);
            }
          }
        })
        .catch(() => {
          // Pas d'utilisateur connecté
        });
    }
  }, [emailParam]);

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: "Email manquant",
        description: "Aucune adresse email n'est disponible pour le renvoi.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    console.log("[VerifyEmail] Tentative de renvoi pour:", email);
    
    try {
      // Essayer d'envoyer l'email via le service
      try {
        await authService.resendConfirmationEmail(email);
        console.log("[VerifyEmail] Email renvoyé avec succès via authService");
      } catch (serviceError: any) {
        console.log("[VerifyEmail] Erreur authService:", serviceError.message);
        
        // Si erreur de session, essayer directement avec Supabase
        if (
          serviceError.message?.includes("session") ||
          serviceError.message?.includes("Auth session missing")
        ) {
          console.log("[VerifyEmail] Retry direct avec Supabase client");
          const supabase = (await import("@/lib/supabase/client")).createClient();
          const { getAuthCallbackUrl } = await import("@/lib/utils/redirect-url");
          const redirectUrl = getAuthCallbackUrl();
          
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email,
            options: {
              emailRedirectTo: redirectUrl,
            },
          });

          if (resendError) {
            console.error("[VerifyEmail] Erreur Supabase resend:", resendError);
            throw resendError;
          }
          console.log("[VerifyEmail] Email renvoyé avec succès via Supabase direct");
        } else {
          throw serviceError;
        }
      }

      setEmailSent(true);
      toast({
        title: "Email envoyé ✅",
        description: "Un nouvel email de confirmation a été envoyé. Vérifiez aussi vos spams !",
      });
    } catch (error: unknown) {
      console.error("[VerifyEmail] Erreur finale:", error);
      
      // Messages d'erreur plus explicites
      let errorMessage = error instanceof Error ? error.message : "Impossible d'envoyer l'email.";
      
      if (error.message?.includes("rate limit") || error.message?.includes("too many")) {
        errorMessage = "Trop de tentatives. Attendez quelques minutes avant de réessayer.";
      } else if (error.message?.includes("already confirmed")) {
        errorMessage = "Cet email est déjà confirmé. Essayez de vous connecter.";
      } else if (error.message?.includes("not found") || error.message?.includes("User not found")) {
        errorMessage = "Aucun compte trouvé avec cet email. Vérifiez l'adresse ou inscrivez-vous.";
      }
      
      toast({
        title: "Erreur d'envoi",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      // Essayer de récupérer l'utilisateur, mais ne pas échouer si pas de session
      try {
        const user = await authService.getUser();
        if (user?.email_confirmed_at) {
          setVerified(true);
          toast({
            title: "Email confirmé",
            description: "Votre email a été confirmé avec succès !",
          });
          setTimeout(() => {
            goToNextStep();
          }, 1000);
          return;
        }
      } catch (sessionError: any) {
        // Pas de session active, c'est normal après la création du compte
        // L'utilisateur doit cliquer sur le lien dans l'email pour créer la session
        if (
          !sessionError.message?.includes("session") &&
          !sessionError.message?.includes("Auth session missing")
        ) {
          throw sessionError;
        }
      }

      toast({
        title: "Email non confirmé",
        description:
          "Votre email n'a pas encore été confirmé. Cliquez sur le lien dans l'email que vous avez reçu pour confirmer votre compte.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de vérifier le statut.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const goToNextStep = () => {
    // Redirection selon le rôle
    switch (role) {
      case "owner":
        // Les propriétaires doivent d'abord choisir leur forfait
        router.push(`/signup/plan?role=owner`);
        break;
      case "tenant":
        router.push("/tenant/onboarding/context");
        break;
      case "provider":
        router.push("/provider/onboarding/profile");
        break;
      case "guarantor":
        router.push("/guarantor/onboarding/context");
        break;
      default:
        router.push("/dashboard");
    }
  };

  const handleContinue = () => {
    goToNextStep();
  };

  if (verified) {
    return (
      <OnboardingShell
        stepLabel="Email vérifié"
        title="Bienvenue dans la suite du parcours"
        subtitle="Nous avons confirmé votre identité. Poursuivez vos formalités."
      >
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 140 }}
          className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5 text-white"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle2 className="h-8 w-8 text-emerald-300" />
          </div>
          <p className="text-center text-sm text-slate-200">
            Votre email a été confirmé avec succès. Nous avons synchronisé votre profil et activé les étapes suivantes.
          </p>
          <Button onClick={handleContinue} className="w-full bg-white text-slate-900 hover:bg-white/90">
            Continuer
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      stepLabel="Étape 3 / 3 – Vérification email"
      title={isMagicLink ? "Consultez le lien magique" : "Confirmez votre email"}
      subtitle="Cela garantit la sécurité de vos documents et l’accès à toutes les fonctionnalités."
      footer={
        <p>
          Pas reçu ?{" "}
          <a href="mailto:support@talok.fr" className="text-white underline-offset-4 hover:underline">
            support@talok.fr
          </a>
        </p>
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 140 }}
        className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-5 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">Action requise</p>
            <p className="text-xs text-slate-300">Nous vous avons envoyé un email sécurisé.</p>
          </div>
          <Badge className="bg-white/10 text-white">Validité 15 min</Badge>
        </div>

        <div className="rounded-xl border border-white/15 bg-black/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold">
                {isMagicLink ? "Lien magique envoyé à" : "Email de confirmation envoyé à"}
              </p>
              {email && <p className="text-sm text-slate-200">{email}</p>}
            </div>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            <li>1. Ouvrez votre boîte de réception.</li>
            <li>2. Cliquez sur le lien sécurisé.</li>
            <li>3. Revenez ici ou laissez l’onglet ouvert : nous détectons automatiquement la validation.</li>
          </ul>
        </div>

        {emailSent && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4" />
            Email renvoyé avec succès ! Vérifiez vos spams si besoin.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            onClick={handleResendEmail}
            disabled={loading || !email}
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
          >
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Renvoyer l’email
              </>
            )}
          </Button>

          <Button onClick={handleCheckStatus} disabled={loading} className="bg-white text-slate-900 hover:bg-white/90">
            {loading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Vérification...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                J’ai confirmé
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400">
          Astuce : utilisez la même fenêtre de navigateur que celle où vous remplissez le questionnaire.
        </p>
      </motion.div>
    </OnboardingShell>
  );
}

