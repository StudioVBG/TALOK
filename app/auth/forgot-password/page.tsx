"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { TalokLogo } from "@/components/marketing/TalokLogo";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, turnstileToken }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      toast({
        title: "Email envoyé",
        description: "Si un compte existe avec cette adresse, vous recevrez un lien de réinitialisation.",
      });
      router.push("/auth/signin");
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

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex justify-center mb-4">
            <TalokLogo variant="light" size="md" />
          </div>
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
                autoComplete="email"
                placeholder="contact@exemple.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <TurnstileWidget onSuccess={setTurnstileToken} />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
