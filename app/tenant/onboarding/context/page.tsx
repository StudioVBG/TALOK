"use client";

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

interface PropertyInfoShort {
  id: string;
  adresse_complete?: string;
  ville?: string;
  code_postal?: string;
  type?: string;
  surface?: number;
  nb_pieces?: number;
}

export default function TenantContextPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfoShort | null>(null);

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

  // Redirection si l'utilisateur a déjà complété cette étape (éviter boucle)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = (await import("@/lib/supabase/client")).createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: progress } = await supabase
          .from("onboarding_progress")
          .select("step")
          .eq("user_id", user.id)
          .eq("role", "tenant");
        const steps = (progress ?? []).map((p: { step: string }) => p.step);
        if (!cancelled && steps.includes("tenant_context")) {
          router.replace("/tenant/onboarding/file");
        }
      } catch {
        // Ignorer les erreurs (RLS, etc.)
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

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
          try {
            const supabase = (await import("@/lib/supabase/client")).createClient();
            const { data: property } = await supabase
              .from("properties")
              .select("id, adresse_complete, ville, code_postal, type, surface, nb_pieces")
              .eq("id", invitation.property_id)
              .single();
            
            if (property) {
              setPropertyInfo(property);
              toast({
                title: "Invitation validée",
                description: `Logement trouvé : ${property.adresse_complete}, ${property.code_postal} ${property.ville}`,
              });
            }
          } catch (err) {
            console.error("[onboarding/context] Erreur chargement propriété depuis invitation:", err);
          }
        }
      }
    } catch (error) {
      console.error("[onboarding/context] Erreur validation invitation:", error);
      toast({
        title: "Invitation invalide",
        description: "Le lien d'invitation n'est plus valide ou a déjà été utilisé.",
        variant: "destructive",
      });
    }
  };

  const handleValidateCode = async () => {
    const trimmed = code?.trim() ?? "";
    if (!trimmed) return;
    if (trimmed.length < 4 || trimmed.length > 20) {
      toast({ title: "Code invalide", description: "Le code doit contenir entre 4 et 20 caractères.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const validation = await propertyCodesService.validatePropertyCode(trimmed);
      if (validation.valid && validation.property) {
        setPropertyInfo(validation.property as PropertyInfoShort);
        setFormData((prev) => ({
          ...prev,
          code_logement: trimmed,
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

      // FIX P0-E4: Accepter l'invitation via route API server (au lieu de client-side)
      // Vérifie l'email, utilise service_role, et lie le profile_id au lease_signers
      if (validated.invite_token) {
        try {
          const acceptRes = await fetch("/api/invitations/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token: validated.invite_token }),
          });

          if (!acceptRes.ok) {
            const acceptError = await acceptRes.json();
            console.error("[onboarding/context] Erreur acceptation invitation:", acceptError);
            // Ne pas bloquer l'onboarding — log l'erreur mais continuer
            if (acceptRes.status === 403) {
              toast({
                title: "Attention",
                description: acceptError.details || acceptError.error || "L'invitation n'a pas pu être liée à votre compte.",
                variant: "destructive",
              });
            }
          }
        } catch (err) {
          console.error("[onboarding/context] Erreur appel accept invitation:", err);
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

