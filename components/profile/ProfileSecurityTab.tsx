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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Lock, Shield, Smartphone } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function ProfileSecurityTab() {
  const router = useRouter();
  const { toast } = useToast();
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handlePasswordChange = async () => {
    if (newPassword.length < 8) {
      toast({
        title: "Mot de passe trop court",
        description: "Le mot de passe doit contenir au moins 8 caractères.",
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
                <Input
                  id="new_password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="8 caractères minimum"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirmer</Label>
                <Input
                  id="confirm_password"
                  type="password"
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

      {/* 2FA placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Authentification à deux facteurs
          </CardTitle>
          <CardDescription>
            Renforcez la sécurité de votre compte
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
            <Shield className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">Bientôt disponible</p>
              <p className="text-sm text-muted-foreground mt-1">
                L&apos;authentification à deux facteurs sera disponible
                prochainement pour renforcer la sécurité de votre compte.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
