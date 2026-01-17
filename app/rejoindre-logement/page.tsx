"use client";
// @ts-nocheck

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { propertyCodesService } from "@/features/onboarding/services/property-codes.service";
import { Key, ArrowRight } from "lucide-react";

export default function JoinPropertyPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = await propertyCodesService.validatePropertyCode(code);

      if (!validation.valid) {
        toast({
          title: "Code invalide",
          description: validation.error || "Ce code de logement n'existe pas.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Rediriger vers l'inscription avec le code
      router.push(`/signup/role?code=${encodeURIComponent(code)}`);
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

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Key className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Rejoindre un logement</CardTitle>
          <CardDescription>
            Entrez le code de logement que vous avez reçu
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code de logement</Label>
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="ABC12345"
                  required
                  disabled={loading}
                  className="pl-10 font-mono text-lg tracking-wider"
                  maxLength={8}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Ce code vous a été communiqué par le propriétaire
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading || !code}>
              {loading ? (
                "Vérification..."
              ) : (
                <>
                  Valider le code
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Vous n'avez pas de code ?{" "}
              <a href="/signup/role" className="text-primary hover:underline">
                Créer un compte
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

