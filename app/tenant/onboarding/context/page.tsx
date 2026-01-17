"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { onboardingService } from "@/features/onboarding/services/onboarding.service";
import { invitationsService } from "@/features/onboarding/services/invitations.service";
import { propertyCodesService } from "@/features/onboarding/services/property-codes.service";
import { tenantContextSchema } from "@/lib/validations/onboarding";
import { Home, Key, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function TenantContextPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [propertyInfo, setPropertyInfo] = useState<any>(null);

  const inviteToken = searchParams.get("invite");
  const codeParam = searchParams.get("code");

  const [formData, setFormData] = useState({
    code_logement: codeParam || "",
    invite_token: inviteToken || "",
    role: "locataire_principal" as "locataire_principal" | "colocataire" | "garant",
  });

  useEffect(() => {
    // Si on a un token d'invitation, charger les infos
    if (inviteToken) {
      loadInvitationData(inviteToken);
    }
  }, [inviteToken]);

  const loadInvitationData = async (token: string) => {
    try {
      const invitation = await invitationsService.validateInvitationToken(token);
      if (invitation) {
        setFormData((prev) => ({
          ...prev,
          invite_token: token,
          role: invitation.role,
        }));
        // Charger les infos du logement si disponible
        if (invitation.property_id) {
          // TODO: Charger les infos du logement
        }
      }
    } catch (error) {
      // Ignorer les erreurs
    }
  };

  const handleValidateCode = async () => {
    if (!code) return;

    setLoading(true);
    try {
      const validation = await propertyCodesService.validatePropertyCode(code);
      if (validation.valid && validation.property) {
        setPropertyInfo(validation.property);
        setFormData((prev) => ({
          ...prev,
          code_logement: code,
        }));
        toast({
          title: "Code validé",
          description: `Logement trouvé : ${validation.property.adresse_complete}`,
        });
      } else {
        toast({
          title: "Code invalide",
          description: validation.error || "Ce code de logement n'existe pas.",
          variant: "destructive",
        });
      }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validated = tenantContextSchema.parse(formData);

      // Sauvegarder le contexte
      await onboardingService.saveDraft("tenant_context", validated, "tenant");
      await onboardingService.markStepCompleted("tenant_context", "tenant");

      // Si on a un token d'invitation, le marquer comme utilisé
      if (validated.invite_token) {
        const supabase = (await import("@/lib/supabase/client")).createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          await invitationsService.markInvitationAsUsed(validated.invite_token, user.id);
        }
      }

      toast({
        title: "Contexte enregistré",
        description: "Vous pouvez maintenant compléter votre dossier.",
      });

      // Rediriger vers le dossier locataire
      router.push("/tenant/onboarding/file");
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
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Home className="w-6 h-6 text-primary" />
            <CardTitle>Contexte logement & rôle</CardTitle>
          </div>
          <CardDescription>
            {inviteToken
              ? "Votre invitation a été chargée. Vérifiez les informations ci-dessous."
              : "Rejoignez un logement en saisissant le code ou en utilisant une invitation"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {!inviteToken && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Code de logement</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="code"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        placeholder="ABC12345"
                        disabled={loading || !!propertyInfo}
                        className="pl-10 font-mono"
                        maxLength={8}
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleValidateCode}
                      disabled={loading || !code || !!propertyInfo}
                    >
                      Valider
                    </Button>
                  </div>
                </div>

                {propertyInfo && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="font-semibold mb-2">Logement trouvé :</p>
                    <p className="text-sm text-muted-foreground">{propertyInfo.adresse_complete}</p>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Votre rôle *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: any) => setFormData({ ...formData, role: value })}
                disabled={!!inviteToken} // Verrouillé si invitation
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="locataire_principal">Locataire principal</SelectItem>
                  <SelectItem value="colocataire">Colocataire</SelectItem>
                  <SelectItem value="garant">Garant</SelectItem>
                </SelectContent>
              </Select>
              {inviteToken && (
                <p className="text-xs text-muted-foreground">
                  Le rôle a été défini par l&apos;invitation
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={loading || (!formData.code_logement && !formData.invite_token)}>
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

