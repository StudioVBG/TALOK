"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { invitationsService } from "@/features/onboarding/services/invitations.service";
import { guarantorContextSchema } from "@/lib/validations/onboarding";
import { User, Calendar, ArrowRight } from "lucide-react";

export default function GuarantorContextPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [invitation, setInvitation] = useState<any>(null);

  const inviteToken = searchParams.get("invite");

  const [formData, setFormData] = useState({
    invite_token: inviteToken || "",
    prenom: "",
    nom: "",
    date_naissance: "",
    piece_identite_path: "",
  });

  const loadInvitationData = useCallback(async (token: string) => {
    try {
      const inv = await invitationsService.validateInvitationToken(token);
      if (inv) {
        setInvitation(inv);
        setFormData((prev) => ({
          ...prev,
          invite_token: token,
        }));
      } else {
        toast({
          title: "Lien invalide",
          description: "Ce lien d'invitation n'est plus valide.",
          variant: "destructive",
        });
        router.push("/auth/signin");
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement de l'invitation.",
        variant: "destructive",
      });
    }
  }, [router, toast]);

  useEffect(() => {
    if (inviteToken) {
      loadInvitationData(inviteToken);
    }
  }, [inviteToken, loadInvitationData]);

  const handleFileUpload = async (file: File) => {
    try {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-piece-identite-${Date.now()}.${fileExt}`;
      const filePath = `guarantor-docs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setFormData((prev) => ({
        ...prev,
        piece_identite_path: filePath,
      }));

      toast({
        title: "Fichier uploadé",
        description: "Votre pièce d'identité a été uploadée avec succès.",
      });
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'upload du fichier.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = guarantorContextSchema.parse({
        ...formData,
        piece_identite_path: formData.piece_identite_path || undefined,
      });

      // Mettre à jour le profil
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      const updateData: any = {
        prenom: validated.prenom,
        nom: validated.nom,
        date_naissance: validated.date_naissance,
      };
      const { error: profileError } = await (supabase
        .from("profiles") as any)
        .update(updateData)
        .eq("user_id", user.id as any);

      if (profileError) throw profileError;

      // Marquer l'invitation comme utilisée
      if (validated.invite_token) {
        await invitationsService.markInvitationAsUsed(validated.invite_token, user.id);
      }

      // Sauvegarder le brouillon
      await onboardingService.saveDraft("guarantor_context", validated, "guarantor" as any);
      await onboardingService.markStepCompleted("guarantor_context", "guarantor" as any);

      toast({
        title: "Informations enregistrées",
        description: "Vos informations ont été sauvegardées.",
      });

      // Rediriger vers la capacité financière
      router.push("/guarantor/onboarding/financial");
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

  if (!inviteToken) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Lien d'invitation requis</CardTitle>
            <CardDescription>
              Vous devez utiliser un lien d'invitation pour accéder à cette page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/auth/signin")} className="w-full">
              Se connecter
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Contexte & identité</CardTitle>
          <CardDescription>
            Complétez vos informations personnelles en tant que garant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {invitation && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-2">
                  <strong>Invitation :</strong> Vous avez été invité en tant que garant pour le logement associé.
                </p>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="prenom"
                    value={formData.prenom}
                    onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                    required
                    disabled={loading}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nom">Nom *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                    required
                    disabled={loading}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_naissance">Date de naissance *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="date_naissance"
                  type="date"
                  value={formData.date_naissance}
                  onChange={(e) => setFormData({ ...formData, date_naissance: e.target.value })}
                  required
                  disabled={loading}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="piece_identite">Pièce d'identité</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="piece_identite"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                  disabled={loading}
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Upload de votre pièce d'identité (PDF, JPG, PNG)
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                "Enregistrement..."
              ) : (
                <>
                  Continuer
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

