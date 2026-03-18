"use client";

/**
 * ProfileSecurityTab — Onglet Sécurité du profil
 *
 * Gestion du mot de passe et des paramètres de sécurité.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/validations/onboarding";
import { SecuritySettings } from "@/components/settings/security-settings";

export function ProfileSecurityTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handlePasswordChange = async () => {
    const { valid, error } = validatePassword(newPassword);
    if (!valid) {
      toast({
        title: "Mot de passe trop faible",
        description: error || "12 caractères minimum avec majuscule, minuscule, chiffre et caractère spécial.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Mots de passe différents",
        description: "Les deux mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Mot de passe modifié",
        description: "Votre mot de passe a été mis à jour avec succès.",
      });
      setIsChangingPassword(false);
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de modifier le mot de passe.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
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
            Modifiez votre mot de passe de connexion
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isChangingPassword ? (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="new_password">Nouveau mot de passe</Label>
                <PasswordInput
                  id="new_password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="12 caractères minimum"
                  autoComplete="new-password"
                />
                <PasswordStrength password={newPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmer</Label>
                <PasswordInput
                  id="confirm_password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Retapez le mot de passe"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handlePasswordChange}
                  disabled={isSaving || !newPassword || !confirmPassword}
                >
                  {isSaving ? "Enregistrement..." : "Enregistrer"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Annuler
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setIsChangingPassword(true)}
            >
              Modifier le mot de passe
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 2FA & Passkeys */}
      <SecuritySettings />
    </div>
  );
}
