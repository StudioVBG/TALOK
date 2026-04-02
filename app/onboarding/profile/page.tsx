"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { User, ArrowRight, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const { toast } = useToast();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prenom.trim() || !nom.trim()) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const { error } = await supabase
        .from("profiles")
        .update({
          prenom: prenom.trim(),
          nom: nom.trim(),
          onboarding_step: "profile_done",
        })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Profil complété",
        description: "Vos informations ont été enregistrées.",
      });
      router.push(from);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de sauvegarder le profil.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
          <User className="w-8 h-8 text-primary" />
        </div>
        <CardTitle className="text-2xl">Complétez votre profil</CardTitle>
        <CardDescription className="text-base">
          Ces informations sont nécessaires pour continuer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prenom">Prénom</Label>
          <Input
            id="prenom"
            type="text"
            placeholder="Jean"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nom">Nom</Label>
          <Input
            id="nom"
            type="text"
            placeholder="Dupont"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            disabled={loading}
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={loading || !prenom.trim() || !nom.trim()}
          className="w-full"
        >
          {loading ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          Continuer
        </Button>
      </CardContent>
    </Card>
  );
}
