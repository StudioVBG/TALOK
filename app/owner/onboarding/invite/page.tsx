"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { invitationsService } from "@/features/onboarding/services/invitations.service";
import { Mail, UserPlus, ArrowRight, X, CheckCircle2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function OwnerInvitePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<string[]>([""]);
  const [role, setRole] = useState<"locataire_principal" | "colocataire" | "garant">("locataire_principal");
  const [invitesSent, setInvitesSent] = useState(false);

  const handleAddEmail = () => {
    setEmails([...emails, ""]);
  };

  const handleRemoveEmail = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validEmails = emails.filter((email) => email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));

      if (validEmails.length === 0) {
        toast({
          title: "Erreur",
          description: "Veuillez saisir au moins un email valide.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Vérifier et envoyer les invitations
      const results = [];
      for (const email of validEmails) {
        try {
          // Vérifier si une invitation en attente existe déjà
          const hasPending = await invitationsService.hasPendingInvitation(email);
          if (hasPending) {
            results.push({ email, status: "pending", message: "Une invitation est déjà en attente pour cet email" });
            continue;
          }

          const invitation = await invitationsService.createInvitation({
            email,
            role,
          });
          results.push({ email, status: "success", invitation });
        } catch (error: unknown) {
          results.push({ email, status: "error", message: error instanceof Error ? error.message : "Erreur lors de la création" });
        }
      }

      const successCount = results.filter((r) => r.status === "success").length;
      const pendingCount = results.filter((r) => r.status === "pending").length;
      const errorCount = results.filter((r) => r.status === "error").length;

      if (successCount > 0) {
        toast({
          title: "Invitations envoyées",
          description: `${successCount} invitation(s) envoyée(s)${pendingCount > 0 ? `, ${pendingCount} déjà en attente` : ""}${errorCount > 0 ? `, ${errorCount} erreur(s)` : ""}.`,
        });
      } else {
        toast({
          title: "Aucune invitation envoyée",
          description: pendingCount > 0
            ? "Toutes les invitations sont déjà en attente."
            : "Erreur lors de l'envoi des invitations.",
          variant: pendingCount > 0 ? "default" : "destructive",
        });
        setLoading(false);
        return;
      }

      // Marquer l'étape comme complétée
      await onboardingService.markStepCompleted("invite_sent", "owner");

      setInvitesSent(true);
      toast({
        title: "Invitations envoyées",
        description: `${validEmails.length} invitation(s) ont été envoyée(s).`,
      });

      // Rediriger vers le dashboard après 2 secondes
      setTimeout(() => {
        router.push("/owner");
      }, 2000);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de l'envoi des invitations.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (invitesSent) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Invitations envoyées !</CardTitle>
            <CardDescription>
              Les invitations ont été envoyées avec succès. Vous allez être redirigé vers votre tableau de bord.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-primary" />
            <CardTitle>Inviter des locataires</CardTitle>
          </div>
          <CardDescription>
            Invitez vos locataires, colocataires ou garants par email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label>Rôle des invités *</Label>
              <Select value={role} onValueChange={(value: any) => setRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="locataire_principal">Locataire principal</SelectItem>
                  <SelectItem value="colocataire">Colocataire</SelectItem>
                  <SelectItem value="garant">Garant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label>Emails à inviter *</Label>
              {emails.map((email, index) => (
                <div key={index} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => handleEmailChange(index, e.target.value)}
                      placeholder="email@example.com"
                      className="pl-10"
                      required={index === 0}
                    />
                  </div>
                  {emails.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleRemoveEmail(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" onClick={handleAddEmail} className="w-full">
                <UserPlus className="mr-2 h-4 w-4" />
                Ajouter un email
              </Button>
            </div>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/owner")}
                className="flex-1"
              >
                Passer cette étape
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? (
                  "Envoi..."
                ) : (
                  <>
                    Envoyer les invitations
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

