"use client";

/**
 * ProfileSecurityTab — Onglet Sécurité du profil
 *
 * Gestion du mot de passe et des paramètres de sécurité.
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Lock } from "lucide-react";
import { SecuritySettings } from "@/components/settings/security-settings";
import { authService } from "@/features/auth/services/auth.service";

interface ProfileSecurityTabProps {
  userEmail: string | null;
}

export function ProfileSecurityTab({ userEmail }: ProfileSecurityTabProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const handlePasswordChangeRequest = async () => {
    if (!userEmail) {
      toast({
        title: "Email introuvable",
        description: "Impossible d'envoyer le lien sécurisé sans email de compte.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      await authService.resetPassword(userEmail);
      toast({
        title: "Lien sécurisé envoyé",
        description:
          "Vérifiez votre boîte email. Le changement de mot de passe se fait désormais via une page dédiée à usage unique.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'envoyer le lien sécurisé de changement de mot de passe.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Mot de passe
          </CardTitle>
          <CardDescription>
            Pour des raisons de sécurité, le changement du mot de passe se fait via un lien unique envoyé à votre adresse email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xl space-y-4">
            <p className="text-sm text-muted-foreground">
              Le lien reçu est temporaire, à usage unique, et ouvre une page dédiée hors dashboard avec vérifications renforcées.
            </p>
            <Button variant="outline" onClick={handlePasswordChangeRequest} disabled={isSending}>
              {isSending ? "Envoi du lien..." : "Recevoir un lien sécurisé"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2FA & Passkeys */}
      <SecuritySettings />
    </div>
  );
}
