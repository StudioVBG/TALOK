"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Mail, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const sendResetEmail = useCallback(async () => {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Erreur lors de l'envoi");
    }
  }, [email]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      await sendResetEmail();
      setEmailSent(true);
    } catch (error: unknown) {
      toast({
        title: "Impossible d'envoyer l'email",
        description: error instanceof Error ? error.message : "Réessayez dans quelques instants.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setResendSuccess(false);
    try {
      await sendResetEmail();
      setResendSuccess(true);
      setResendCooldown(60);
      toast({
        title: "Email renvoyé",
        description: "Un nouveau lien de réinitialisation a été envoyé.",
      });
    } catch (error: unknown) {
      toast({
        title: "Impossible de renvoyer l'email",
        description: error instanceof Error ? error.message : "Réessayez dans quelques instants.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Écran de confirmation après envoi
  if (emailSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Vérifiez votre boîte de réception</CardTitle>
            <CardDescription className="text-base">
              Nous avons envoyé un lien de réinitialisation à
              <span className="font-semibold text-foreground block mt-2">
                {email}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Pour réinitialiser votre mot de passe :</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>Ouvrez votre boîte de réception</li>
                <li>Cliquez sur le lien de réinitialisation dans l'email</li>
                <li>Choisissez un nouveau mot de passe sécurisé</li>
              </ol>
            </div>

            {resendSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  Email renvoyé avec succès !
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Button
                onClick={handleResend}
                disabled={loading || resendCooldown > 0}
                className="w-full"
                variant="outline"
              >
                {loading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Envoi en cours...
                  </>
                ) : resendCooldown > 0 ? (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Renvoyer dans {resendCooldown}s
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Renvoyer l'email
                  </>
                )}
              </Button>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                Vous n'avez pas reçu l'email ? Vérifiez votre dossier spam ou{" "}
                <button
                  onClick={handleResend}
                  disabled={loading || resendCooldown > 0}
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

  // Formulaire de saisie de l'email
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>
            Saisissez l'adresse email de votre compte pour recevoir un lien de réinitialisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="contact@exemple.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </Button>
            <div className="text-center">
              <Link
                href="/auth/signin"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Retour à la connexion
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
