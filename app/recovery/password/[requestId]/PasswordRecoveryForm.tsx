"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface PasswordRecoveryFormProps {
  requestId: string;
}

export function PasswordRecoveryForm({ requestId }: PasswordRecoveryFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/password-recovery/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
        body: JSON.stringify({
          requestId,
          password,
          confirmPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Impossible de mettre à jour le mot de passe.");
      }

      toast({
        title: "Mot de passe mis à jour",
        description: "Vous pouvez maintenant vous reconnecter avec votre nouveau mot de passe.",
      });

      router.replace(payload.redirectTo || "/auth/signin?passwordChanged=1");
    } catch (error: unknown) {
      toast({
        title: "Lien invalide ou expiré",
        description:
          error instanceof Error
            ? error.message
            : "Veuillez effectuer une nouvelle demande de changement de mot de passe.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="password">Nouveau mot de passe</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoComplete="new-password"
        />
        <PasswordStrength password={password} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirm-password">Confirmation</Label>
        <PasswordInput
          id="confirm-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          autoComplete="new-password"
        />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Mise à jour..." : "Définir mon nouveau mot de passe"}
      </Button>
    </form>
  );
}
