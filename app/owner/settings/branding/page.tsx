"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Building2,
  Sparkles,
  ArrowRight,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ProtectedRoute } from "@/components/protected-route";
import { BrandingForm } from "@/components/white-label/branding-form";
import { FeatureList } from "@/components/white-label/feature-gate";
import { createClient } from "@/lib/supabase/client";
import {
  WhiteLabelLevel,
  OrganizationBranding,
  planToWhiteLabelLevel,
  WHITE_LABEL_LEVEL_INFO,
} from "@/lib/white-label/types";

export default function OwnerBrandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [branding, setBranding] = useState<Partial<OrganizationBranding>>({});
  const [level, setLevel] = useState<WhiteLabelLevel>("none");
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/signin");
        return;
      }

      // Récupérer l'abonnement pour déterminer le niveau
      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("plan_id, subscription_plans(slug)")
        .eq("owner_id", user.id)
        .eq("status", "active")
        .single();

      const planSlug = (subscription?.subscription_plans as any)?.slug || "gratuit";
      const whiteLabelLevel = planToWhiteLabelLevel(planSlug);
      setLevel(whiteLabelLevel);

      // Si pas d'accès white-label, ne pas charger d'organisation
      if (whiteLabelLevel === "none") {
        setIsLoading(false);
        return;
      }

      // Chercher l'organisation de l'utilisateur
      const { data: org } = await supabase
        .from("organizations")
        .select(`
          *,
          branding:organization_branding(*),
          domains:custom_domains(*)
        `)
        .eq("owner_id", user.id)
        .single();

      if (org) {
        setOrganization(org);
        setBranding(org.branding || {});
      } else {
        // Créer automatiquement une organisation si l'utilisateur a le droit
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", user.id)
          .single();

        const orgName = profile?.full_name || "Mon Entreprise";
        const slug = orgName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        const { data: newOrg, error: createError } = await supabase
          .from("organizations")
          .insert({
            name: orgName,
            slug: `${slug}-${Date.now()}`,
            owner_id: user.id,
            white_label_level: whiteLabelLevel,
          })
          .select(`
            *,
            branding:organization_branding(*),
            domains:custom_domains(*)
          `)
          .single();

        if (createError) {
          console.error("Erreur création organisation:", createError);
        } else {
          setOrganization(newOrg);
          setBranding(newOrg?.branding || {});
        }
      }
    } catch (err) {
      console.error("Erreur chargement:", err);
      setError("Erreur lors du chargement des données");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (updates: Partial<OrganizationBranding>) => {
    if (!organization) return;

    const { error } = await supabase
      .from("organization_branding")
      .update(updates)
      .eq("organization_id", organization.id);

    if (error) {
      throw error;
    }

    setBranding((prev) => ({ ...prev, ...updates }));
  };

  const handleUploadAsset = async (type: string, file: File): Promise<string> => {
    if (!organization) throw new Error("Pas d'organisation");

    const fileName = `${organization.id}/${type}-${Date.now()}.${file.name.split(".").pop()}`;

    const { error: uploadError } = await supabase.storage
      .from("branding-assets")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("branding-assets")
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleUpgrade = () => {
    router.push("/owner/settings/subscription");
  };

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Marque Blanche</h1>
          <p className="text-muted-foreground">
            Personnalisez l'apparence de votre plateforme
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erreur</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* No access */}
        {!isLoading && level === "none" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card>
              <CardContent className="p-8">
                <div className="text-center max-w-lg mx-auto">
                  <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900 mb-3">
                    White-Label non disponible
                  </h2>

                  <p className="text-slate-600 mb-6">
                    La personnalisation de marque blanche est disponible à partir du forfait
                    <strong className="text-slate-900"> Enterprise M</strong>.
                    Passez à un forfait supérieur pour personnaliser votre plateforme.
                  </p>

                  <div className="space-y-4 mb-8">
                    <h3 className="font-medium text-slate-700">
                      Fonctionnalités disponibles :
                    </h3>
                    <FeatureList
                      currentLevel="none"
                      showAll={true}
                    />
                  </div>

                  <Button size="lg" onClick={handleUpgrade}>
                    <Sparkles className="w-5 h-5 mr-2" />
                    Passer à Enterprise
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Has access */}
        {!isLoading && level !== "none" && organization && (
          <BrandingForm
            branding={branding}
            level={level}
            organizationId={organization.id}
            onSave={handleSave}
            onUploadAsset={handleUploadAsset}
            onUpgrade={level !== "premium" ? handleUpgrade : undefined}
          />
        )}

        {/* Niveau actuel info */}
        {!isLoading && level !== "none" && (
          <Card className="bg-slate-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Votre niveau actuel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {WHITE_LABEL_LEVEL_INFO[level].label}
                  </p>
                  <p className="text-sm text-slate-500">
                    {WHITE_LABEL_LEVEL_INFO[level].description}
                  </p>
                </div>
                {level !== "premium" && (
                  <Button variant="outline" onClick={handleUpgrade}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Débloquer plus
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}
