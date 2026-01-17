"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { authService } from "@/features/auth/services/auth.service";
import { Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function VerifyEmailPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    // Vérifier d'abord si on a un email en attente depuis la session
    if (typeof window !== "undefined") {
      const pendingEmail = sessionStorage.getItem("pendingEmailVerification");
      if (pendingEmail) {
        setEmail(pendingEmail);
        sessionStorage.removeItem("pendingEmailVerification");
      }
    }

    // Récupérer l'email de l'utilisateur
    authService
      .getUser()
      .then((user) => {
        if (user?.email) {
          setEmail(user.email);
          // Vérifier si l'email est déjà confirmé
          if (user.email_confirmed_at) {
            router.push("/dashboard");
          }
        } else {
          // Si on a un email en session mais pas d'utilisateur connecté, on peut continuer
          if (typeof window !== "undefined" && sessionStorage.getItem("pendingEmailVerification")) {
            return;
          }
          // Pas d'utilisateur connecté, rediriger vers la page de connexion
          router.push("/auth/signin");
        }
      })
      .catch(() => {
        // Si on a un email en session, on peut continuer
        if (typeof window !== "undefined" && sessionStorage.getItem("pendingEmailVerification")) {
          return;
        }
        router.push("/auth/signin");
      });
  }, [router]);

  const handleResendEmail = async () => {
    if (!email) {
      toast({
        title: "Erreur",
        description: "Aucun email disponible. Veuillez vous reconnecter.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Essayer d'envoyer l'email via le service
      try {
        await authService.resendConfirmationEmail(email);
      } catch (serviceError: any) {
        // Si erreur de session, essayer directement avec Supabase
        if (
          serviceError.message?.includes("session") ||
          serviceError.message?.includes("Auth session missing")
        ) {
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

          if (resendError) throw resendError;
        } else {
          throw serviceError;
        }
      }

      setEmailSent(true);
      toast({
        title: "Email envoyé",
        description: "Un nouvel email de confirmation a été envoyé. Vérifiez votre boîte de réception.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer l'email de confirmation.",
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
          toast({
            title: "Email confirmé",
            description: "Votre email a été confirmé avec succès !",
          });
          router.push("/dashboard");
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Vérifiez votre email</CardTitle>
          <CardDescription className="text-base">
            Nous avons envoyé un email de confirmation à
            {email && (
              <span className="font-semibold text-foreground block mt-2">
                {email}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Pour activer votre compte :</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>Ouvrez votre boîte de réception</li>
              <li>Cliquez sur le lien de confirmation dans l'email</li>
              <li>Vous serez automatiquement redirigé vers votre tableau de bord</li>
            </ol>
          </div>

          {emailSent && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              <p className="text-sm text-green-800 dark:text-green-200">
                Email renvoyé avec succès !
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Button
              onClick={handleResendEmail}
              disabled={loading || !email}
              className="w-full"
              variant="outline"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Renvoyer l'email
                </>
              )}
            </Button>

            <Button
              onClick={handleCheckStatus}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Vérification...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  J'ai confirmé mon email
                </>
              )}
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground text-center">
              Vous n'avez pas reçu l'email ? Vérifiez votre dossier spam ou{" "}
              <button
                onClick={handleResendEmail}
                disabled={loading}
                className="text-primary hover:underline font-medium"
              >
                renvoyez-le
              </button>
            </p>
          </div>

          <div className="pt-2">
            <Link
              href="/auth/signin"
              className="text-sm text-muted-foreground hover:text-foreground text-center block"
            >
              Retour à la connexion
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

