"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { invitationsService } from "@/features/onboarding/services/invitations.service";
import { Mail, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const token = params.token as string;

  useEffect(() => {
    const validateInvitation = async () => {
      try {
        const inv = await invitationsService.validateInvitationToken(token);
        if (!inv) {
          setError("Lien d'invitation invalide ou expiré");
          return;
        }
        setInvitation(inv);
      } catch (err: any) {
        setError(err.message || "Erreur lors de la validation");
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      validateInvitation();
    }
  }, [token]);

  const handleAcceptInvitation = () => {
    // Rediriger vers l'inscription avec le token et le rôle
    router.push(`/signup/role?invite=${token}&role=${invitation.role}`);
  };

  const handleResendInvitation = async () => {
    if (!invitation) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/invites/${invitation.id}/resend`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors du renvoi");
      }

      toast({
        title: "Invitation renvoyée",
        description: "Un nouvel email d'invitation a été envoyé. Le propriétaire a été notifié.",
      });
      
      // Recharger la page pour afficher le nouveau token
      window.location.reload();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de renvoyer l'invitation.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Lien invalide</CardTitle>
            <CardDescription>{error || "Ce lien d'invitation n'est plus valide"}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Le lien peut avoir expiré ou avoir déjà été utilisé.
            </p>
            <Button onClick={handleResendInvitation} className="w-full" variant="outline">
              <Mail className="mr-2 h-4 w-4" />
              Demander un nouveau lien
            </Button>
            <div className="text-center">
              <Link href="/auth/signin" className="text-sm text-primary hover:underline">
                Se connecter
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Mail className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Invitation reçue</CardTitle>
          <CardDescription>
            Vous avez été invité à rejoindre un logement en tant que{" "}
            <span className="font-semibold">
              {invitation.role === "locataire_principal" && "Locataire principal"}
              {invitation.role === "colocataire" && "Colocataire"}
              {invitation.role === "garant" && "Garant"}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Email invité :</p>
            <p className="font-semibold">{invitation.email}</p>
          </div>

          <Button onClick={handleAcceptInvitation} className="w-full">
            Accepter l'invitation
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Vous avez déjà un compte ?{" "}
              <Link href={`/auth/signin?email=${encodeURIComponent(invitation.email)}`} className="text-primary hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

