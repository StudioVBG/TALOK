"use client";
// @ts-nocheck

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  ExternalLink,
  Edit,
  Lock,
  FileText,
  Loader2,
  CheckCircle,
  Users,
} from "lucide-react";
import { LeasePreview } from "@/features/leases/components/lease-preview";
import { useToast } from "@/components/ui/use-toast";
import type { LeaseDetails } from "../../../_data/fetchLeaseDetails";
import { mapLeaseToTemplate } from "@/lib/mappers/lease-to-template";
import { OwnerSignatureModal } from "../OwnerSignatureModal";
import { Celebration, useCelebration } from "@/components/ui/celebration";
import { formatCurrency } from "@/lib/helpers/format";

interface ContractViewProps {
  details: LeaseDetails;
  leaseId: string;
  ownerProfile?: {
    id: string;
    prenom: string;
    nom: string;
    email?: string;
    telephone?: string;
    adresse?: string;
    type?: string;
    raison_sociale?: string;
    forme_juridique?: string;
    siret?: string;
  };
}

export function ContractView({ details, leaseId, ownerProfile }: ContractViewProps) {
  const { lease, property, signers } = details;
  const router = useRouter();
  const { toast } = useToast();
  const { celebrate, celebrationProps } = useCelebration();
  const [isSigning, setIsSigning] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);

  const isSealed = !!(lease as any).sealed_at || ["fully_signed", "active", "terminated", "archived"].includes(lease.statut);
  const signedPdfPath = (lease as any).signed_pdf_path;
  const sealedAt = (lease as any).sealed_at;

  const bailData = mapLeaseToTemplate(details, ownerProfile);

  const mainTenant = signers?.find((s: any) => {
    const role = (s.role || "").toLowerCase();
    return role === "locataire_principal" || role === "locataire" || role === "tenant";
  });

  const ownerSigner = signers?.find((s: any) => {
    const role = (s.role || "").toLowerCase();
    return role === "proprietaire" || role === "owner" || role === "bailleur";
  });

  const needsOwnerSignature = useMemo(() => {
    if (["fully_signed", "active", "terminated", "archived"].includes(lease.statut)) return false;
    if (ownerSigner?.signature_status === "signed") return false;
    return mainTenant?.signature_status === "signed";
  }, [lease.statut, mainTenant?.signature_status, ownerSigner?.signature_status]);

  const handleOwnerSign = async (signatureImage: string) => {
    setIsSigning(true);
    try {
      const response = await fetch(`/api/leases/${leaseId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: "SES", signature_image: signatureImage }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erreur lors de la signature");
      setShowSignatureModal(false);
      celebrate({
        title: "Bail signé !",
        subtitle: "Toutes les parties ont signé. Prochaine étape : l'état des lieux d'entrée.",
        type: "milestone",
        nextAction: {
          label: "Créer l'état des lieux",
          href: `/owner/leases/${leaseId}/inspection`,
        },
      });
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de signer le bail",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSigning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Contrat de bail</h2>
        <div className="flex items-center gap-2">
          {needsOwnerSignature && (
            <Button
              size="sm"
              onClick={() => setShowSignatureModal(true)}
              disabled={isSigning}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Signer le bail
            </Button>
          )}
          {!isSealed && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/owner/leases/${leaseId}/edit`}>
                <Edit className="h-4 w-4 mr-2" />
                Modifier
              </Link>
            </Button>
          )}
          {isSealed && signedPdfPath && (
            <Button variant="outline" size="sm" className="bg-emerald-50 text-emerald-700 border-emerald-200" asChild>
              <a href={`/api/documents/download?path=${encodeURIComponent(signedPdfPath)}&filename=Bail_${property.ville || "Logement"}.pdf`} download>
                <Download className="h-4 w-4 mr-2" />
                Télécharger PDF
              </a>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Contract preview */}
        <div className="lg:col-span-8 xl:col-span-9">
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ height: "calc(100vh - 16rem)" }}>
            {isSealed && signedPdfPath ? (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-emerald-50 to-green-50">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 rounded-full">
                      <Lock className="h-3.5 w-3.5 text-emerald-700" />
                      <span className="text-xs font-semibold text-emerald-700">Document scellé</span>
                    </div>
                    {sealedAt && (
                      <span className="text-xs text-slate-500">
                        le {new Date(sealedAt).toLocaleDateString("fr-FR")}
                      </span>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild className="text-emerald-700 border-emerald-200">
                    <a href={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1.5" />
                      Ouvrir
                    </a>
                  </Button>
                </div>
                <iframe
                  src={`/api/documents/view?path=${encodeURIComponent(signedPdfPath)}`}
                  className="flex-1 w-full border-0"
                  title="Bail de location signé"
                />
              </div>
            ) : (
              <LeasePreview typeBail={lease.type_bail} bailData={bailData} leaseId={leaseId} />
            )}
          </div>
        </div>

        {/* Sidebar: Signataires */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Signataires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {signers?.map((signer: any) => (
                <div key={signer.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold">
                      {signer.profile?.prenom?.[0]}
                      {signer.profile?.nom?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {signer.profile?.prenom} {signer.profile?.nom}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">{signer.role}</p>
                    </div>
                  </div>
                  <Badge
                    className={
                      signer.signature_status === "signed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-700 border-amber-200"
                    }
                    variant="outline"
                  >
                    {signer.signature_status === "signed" ? "Signé" : "En attente"}
                  </Badge>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full mt-2" asChild>
                <Link href={`/owner/leases/${leaseId}/signers`}>Gérer les signataires</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Key details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Détails financiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Loyer HC</span>
                <span className="text-sm font-medium">{formatCurrency(lease.loyer || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Charges</span>
                <span className="text-sm font-medium">{formatCurrency(lease.charges_forfaitaires || 0)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-sm font-medium">Total mensuel</span>
                <span className="text-sm font-bold">{formatCurrency((lease.loyer || 0) + (lease.charges_forfaitaires || 0))}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <OwnerSignatureModal
        isOpen={showSignatureModal}
        onClose={() => setShowSignatureModal(false)}
        onSign={handleOwnerSign}
        leaseInfo={{
          id: leaseId,
          typeBail: lease.type_bail,
          loyer: lease.loyer || 0,
          charges: lease.charges_forfaitaires || 0,
          propertyAddress: property.adresse_complete || "",
          propertyCity: property.ville || "",
          tenantName: mainTenant?.profile ? `${mainTenant.profile.prenom || ""} ${mainTenant.profile.nom || ""}`.trim() : undefined,
          dateDebut: lease.date_debut,
        }}
        ownerName={ownerProfile ? `${ownerProfile.prenom || ""} ${ownerProfile.nom || ""}`.trim() : ""}
      />
      <Celebration {...celebrationProps} />
    </div>
  );
}
