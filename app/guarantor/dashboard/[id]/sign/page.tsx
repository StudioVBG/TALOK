"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/components/ui/use-toast";
import {
  FileSignature,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { CautionActeViewer } from "@/components/guarantor/CautionActeViewer";
import { VisaleChecker } from "@/components/guarantor/VisaleChecker";
import { guarantorProfilesService } from "@/features/profiles/services/guarantor-profiles.service";
import type { GuarantorEngagement, CautionType } from "@/lib/types/guarantor";
import { extractErrorMessage } from "@/lib/helpers/extract-error-message";

interface EngagementWithDetails extends GuarantorEngagement {
  tenant?: { id: string; prenom: string; nom: string };
  lease?: {
    id: string;
    loyer: number;
    charges_forfaitaires: number;
    date_debut: string;
    property?: { id: string; adresse_complete: string; ville: string };
  };
}

export default function SignEngagementPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const engagementId = params.id as string;

  const [engagement, setEngagement] = useState<EngagementWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [visaleNumber, setVisaleNumber] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  useEffect(() => {
    async function loadEngagement() {
      try {
        const data = await guarantorProfilesService.getEngagement(engagementId);
        setEngagement(data as EngagementWithDetails | null);
      } catch (err: any) {
        console.error("Erreur chargement engagement:", err);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger l'engagement",
        });
      } finally {
        setLoading(false);
      }
    }
    loadEngagement();
  }, [engagementId, toast]);

  const handleSign = async () => {
    if (!consentChecked) {
      toast({
        variant: "destructive",
        title: "Consentement requis",
        description: "Vous devez accepter les conditions avant de signer.",
      });
      return;
    }

    setSigning(true);
    try {
      const response = await fetch(`/api/guarantors/engagements/${engagementId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ visale_number: visaleNumber }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erreur lors de la signature");
      }

      setSigned(true);
      toast({
        title: "Acte signé !",
        description: "Votre engagement de caution a été signé avec succès.",
      });

      setTimeout(() => {
        router.push("/guarantor/dashboard");
      }, 3000);
    } catch (error: unknown) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: extractErrorMessage(error),
      });
    } finally {
      setSigning(false);
    }
  };

  // Map DB type_garantie to CautionType
  const mapCautionType = (type: string): CautionType => {
    if (type === "caution_simple") return "simple";
    if (type === "caution_solidaire") return "solidaire";
    if (type === "visale") return "visale";
    return "solidaire";
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-3xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="container mx-auto p-6 max-w-3xl">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Engagement non trouvé ou vous n'avez pas l'autorisation d'y accéder.
          </AlertDescription>
        </Alert>
        <Link href="/guarantor/dashboard" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </Link>
      </div>
    );
  }

  if (signed) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card className="text-center py-12">
          <CardContent>
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Acte signé avec succès !</h2>
            <p className="text-muted-foreground mb-4">
              Votre engagement de caution est désormais actif. Le propriétaire a été notifié.
            </p>
            <p className="text-sm text-muted-foreground">
              Redirection vers le tableau de bord...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cautionType = mapCautionType((engagement as any).type_garantie || engagement.caution_type || "solidaire");
  const tenantName = engagement.tenant
    ? `${engagement.tenant.prenom || ""} ${engagement.tenant.nom || ""}`.trim()
    : "le locataire";
  const propertyAddress = engagement.lease?.property?.adresse_complete || "";
  const propertyVille = engagement.lease?.property?.ville || "";
  const loyer = engagement.lease?.loyer || 0;
  const charges = engagement.lease?.charges_forfaitaires || 0;

  const isPending = (engagement as any).statut === "pending" || engagement.status === "pending_signature";

  return (
    <div className="container mx-auto p-6 max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/guarantor/dashboard">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Signer l'acte de caution</h1>
          <p className="text-muted-foreground">
            Lisez attentivement l'acte avant de signer
          </p>
        </div>
      </div>

      {!isPending && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Cet engagement n'est pas en attente de signature. Il a peut-être déjà été signé ou annulé.
          </AlertDescription>
        </Alert>
      )}

      {/* Acte de caution */}
      <CautionActeViewer
        cautionType={cautionType}
        guarantorName="[Votre nom]"
        tenantName={tenantName}
        propertyAddress={propertyAddress}
        propertyVille={propertyVille}
        loyer={loyer}
        charges={charges}
        montantGaranti={engagement.montant_garanti}
        dureeEngagement={(engagement as any).duree_engagement || "duree_bail"}
        visaleNumber={visaleNumber}
      />

      {/* Visale checker si type visale */}
      {cautionType === "visale" && (
        <VisaleChecker
          onVisaleConfirmed={setVisaleNumber}
          defaultNumber={engagement.visale_number || undefined}
        />
      )}

      {/* Consentement et signature */}
      {isPending && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileSignature className="h-5 w-5 text-primary" />
              <CardTitle>Signature électronique</CardTitle>
            </div>
            <CardDescription>
              En signant cet acte, vous vous engagez en tant que caution conformément aux termes ci-dessus.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <input
                type="checkbox"
                id="consent-sign"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="consent-sign" className="cursor-pointer space-y-1">
                <p className="font-medium text-sm">
                  Je confirme avoir lu et compris l'acte de cautionnement ci-dessus
                </p>
                <p className="text-sm text-muted-foreground">
                  Je m'engage volontairement en tant que caution {cautionType === "solidaire" ? "solidaire" : cautionType === "simple" ? "simple" : "Visale"} pour
                  le locataire {tenantName} et j'accepte l'ensemble des obligations qui en découlent.
                </p>
              </label>
            </div>

            {cautionType === "visale" && !visaleNumber && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800">
                  Veuillez renseigner et vérifier votre numéro Visale ci-dessus avant de signer.
                </AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleSign}
              disabled={signing || !consentChecked || (cautionType === "visale" && !visaleNumber)}
              className="w-full"
              size="lg"
            >
              {signing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signature en cours...
                </>
              ) : (
                <>
                  <FileSignature className="h-4 w-4 mr-2" />
                  Signer l'acte de cautionnement
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
