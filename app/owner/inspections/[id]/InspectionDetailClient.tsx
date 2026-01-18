"use client";
// @ts-nocheck

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ClipboardList,
  Home,
  Calendar,
  User,
  Camera,
  Download,
  Share2,
  Edit,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  FileSignature,
  ChevronDown,
  ChevronRight,
  Image,
  Send,
  Loader2,
  ArrowLeft,
  Printer,
  Mail,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { EDLPreview } from "@/features/edl/components/edl-preview";
import { mapRawEDLToTemplate } from "@/lib/mappers/edl-to-template";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";

interface Room {
  name: string;
  items: Array<{
    id: string;
    room_name: string;
    item_name: string;
    condition: string | null;
    notes: string | null;
    created_at: string;
    media: Array<{
      id: string;
      storage_path: string;
      media_type: string;
      thumbnail_path: string | null;
      taken_at: string;
    }>;
  }>;
  stats: {
    total: number;
    completed: number;
    bon: number;
    moyen: number;
    mauvais: number;
    tres_mauvais: number;
  };
}

interface InspectionData {
  raw: {
    id: string;
    type: string;
    status: string;
    scheduled_at: string | null;
    completed_date: string | null;
    created_at: string;
    lease: {
      id: string;
      property: {
        id: string;
        adresse_complete: string;
        ville: string;
        code_postal: string;
      };
      signers: Array<{
        role: string;
        profile_id?: string | null;
        signed_at?: string | null;
        invited_email?: string | null;
        invited_name?: string | null;
        profile?: {
          id: string;
          prenom: string;
          nom: string;
          email: string;
          avatar_url?: string;
          user_id?: string;
        } | null;
      }>;
    };
    edl_items: any[];
    edl_media: any[];
    edl_signatures: any[];
  };
  meterReadings: any[];
  propertyMeters: any[]; // Ajouté
  ownerProfile: any;
  rooms: Room[];
  stats: {
    totalItems: number;
    completedItems: number;
    totalPhotos: number;
    signaturesCount: number;
  };
}

interface Props {
  data: InspectionData;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-800", icon: Clock },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-800", icon: ClipboardList },
  completed: { label: "Terminé", color: "bg-amber-100 text-amber-800", icon: CheckCircle2 },
  signed: { label: "Signé", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  disputed: { label: "Contesté", color: "bg-red-100 text-red-800", icon: AlertCircle },
};

const conditionConfig: Record<string, { label: string; color: string }> = {
  bon: { label: "Bon état", color: "bg-green-100 text-green-800" },
  moyen: { label: "État moyen", color: "bg-yellow-100 text-yellow-800" },
  mauvais: { label: "Mauvais état", color: "bg-orange-100 text-orange-800" },
  tres_mauvais: { label: "Très mauvais", color: "bg-red-100 text-red-800" },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function InspectionDetailClient({ data }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  
  // États
  const [isSending, setIsSending] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Données
  const { raw: edl, meterReadings, propertyMeters, ownerProfile, stats } = data;

  // 1. Adapter les signatures pour le mapper
  // ✅ SOTA 2026: Utiliser l'URL signée en priorité pour les images de signature
  const adaptedSignatures = (edl.edl_signatures || []).map((s: any) => ({
    id: s.id,
    edl_id: edl.id,
    signer_type: s.signer_role,
    signer_profile_id: s.signer_profile_id || s.signer_user,
    // ✅ FIX: Priorité URL signée > path brut
    signature_image: s.signature_image_url || s.signature_image_path,
    signature_image_path: s.signature_image_path, // Garder le path pour référence
    signature_image_url: s.signature_image_url,
    signed_at: s.signed_at,
    ip_address: s.ip_inet,
    invitation_sent_at: s.invitation_sent_at,
    invitation_token: s.invitation_token,
    profile: s.profile,
  }));

  // 2. Adapter les relevés de compteurs (et inclure les compteurs sans relevé)
  // 🔧 FIX: Utiliser les compteurs des relevés ET ceux du bien pour éviter les doublons
  const recordedMeterIds = new Set((meterReadings || []).map((r: any) => r.meter_id));

  // Compteurs avec relevés (provenant des meterReadings)
  const existingReadings = (meterReadings || []).map((r: any) => ({
    type: r.meter?.type || "electricity",
    meter_number: r.meter?.meter_number || r.meter?.serial_number,
    reading: String(r.reading_value),
    unit: r.reading_unit || r.meter?.unit || "kWh",
    photo_url: r.photo_path,
  }));

  // Compteurs du bien sans relevé (seulement ceux qui n'ont pas de relevé)
  const missingMeters = (propertyMeters || [])
    .filter((m: any) => !recordedMeterIds.has(m.id))
    .map((m: any) => ({
      type: m.type || "electricity",
      meter_number: m.meter_number || m.serial_number,
      reading: "Non relevé", // Valeur explicite pour l'affichage
      unit: m.unit || "kWh",
      photo_url: null,
    }));

  const adaptedMeterReadings = [...existingReadings, ...missingMeters];

  // 🔧 FIX: Créer une liste unifiée de compteurs pour l'affichage dans "Données techniques"
  // Cette liste combine les compteurs des relevés (avec valeur) et ceux du bien (sans relevé)
  const unifiedMetersForDisplay = [
    // Compteurs avec relevés existants
    ...(meterReadings || []).map((r: any) => ({
      id: r.meter_id || r.id,
      type: r.meter?.type || "electricity",
      meter_number: r.meter?.meter_number || r.meter?.serial_number,
      serial_number: r.meter?.serial_number,
      location: r.meter?.location,
      hasReading: true,
      readingValue: r.reading_value,
      readingUnit: r.reading_unit || r.meter?.unit || "kWh",
    })),
    // Compteurs du bien sans relevé
    ...(propertyMeters || [])
      .filter((m: any) => !recordedMeterIds.has(m.id))
      .map((m: any) => ({
        id: m.id,
        type: m.type || "electricity",
        meter_number: m.meter_number || m.serial_number,
        serial_number: m.serial_number,
        location: m.location,
        hasReading: false,
        readingValue: null,
        readingUnit: m.unit || "kWh",
      })),
  ];

  // 3. Adapter les médias
  const adaptedMedia = (edl.edl_media || []).map((m: any) => ({
    id: m.id,
    edl_id: edl.id,
    item_id: m.item_id,
    file_path: m.storage_path,
    type: m.media_type || "photo",
    room_name: m.section, // 🔧 Correction: mapper la section pour l'affichage des photos globales
  }));

  // 4. Mapper les données pour l'aperçu du document
  const edlTemplateData = mapRawEDLToTemplate(
    edl as any,
    ownerProfile,
    edl.edl_items || [],
    adaptedMedia,
    adaptedMeterReadings,
    adaptedSignatures,
    edl.keys || []
  );

  // Handlers
  const handleDownloadPDF = async () => {
    try {
      setIsDownloading(true);
      
      const response = await fetch("/api/edl/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          edlId: edl.id,
          edlData: edlTemplateData
        }),
      });

      if (!response.ok) throw new Error("Erreur génération HTML");
      
      const { html: pdfHtml, fileName } = await response.json();
      const html2pdf = (await import("html2pdf.js")).default;
      
      const opt = {
        margin: 10,
        filename: fileName || `EDL_${edl.type}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      const element = document.createElement("div");
      element.innerHTML = pdfHtml;
      document.body.appendChild(element);

      await html2pdf().set(opt).from(element).save();
      document.body.removeChild(element);
      
      toast({
        title: "Succès",
        description: "Le PDF a été généré et téléchargé.",
      });
    } catch (error: unknown) {
      console.error("Erreur téléchargement PDF:", error);
      toast({
        title: "Erreur",
        description: "Impossible de générer le PDF.",
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSign = async (signatureData: SignatureData) => {
    try {
      setIsSigning(true);
      const response = await fetch(`/api/edl/${edl.id}/sign`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ signature: signatureData.data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la signature");
      }

      toast({
        title: "✅ État des lieux signé",
        description: "Votre signature a été enregistrée avec succès.",
      });

      setIsSignModalOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSigning(false);
    }
  };

  const handleSendToTenant = async (signerProfileId: string | null, invitedEmail?: string) => {
    try {
      setIsSending(true);
      const response = await fetch(`/api/edl/${edl.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          signer_profile_id: signerProfileId || undefined,
          invited_email: invitedEmail || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de l'envoi de l'invitation");
      }

      toast({
        title: "Invitation envoyée",
        description: "Le locataire a reçu un email pour signer l'EDL.",
      });
      
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Calculs pour l'affichage
  const status = statusConfig[edl.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const completionPercentage = stats.totalItems > 0
    ? Math.round((stats.completedItems / stats.totalItems) * 100)
    : 0;

  // ===============================
  // ANALYSE DES SIGNATURES ET DONNÉES
  // ===============================
  const ownerSignature = edl.edl_signatures?.find((s: any) => 
    s.signer_role === "owner" || s.signer_role === "proprietaire"
  );
  const tenantSignature = edl.edl_signatures?.find((s: any) => 
    s.signer_role === "tenant" || s.signer_role === "locataire"
  );
  
  // Chercher le locataire dans le bail
  const mainTenantFromLease = edl.lease?.signers?.find((s: any) => 
    ['tenant', 'locataire_principal', 'locataire', 'principal'].includes(s.role)
  );

  // ===============================
  // DÉTERMINER L'ÉTAT DU LOCATAIRE
  // ===============================

  // Cas 1: Le locataire a-t-il un vrai profil lié?
  const tenantHasRealProfile = !!(
    mainTenantFromLease?.profile?.id || 
    mainTenantFromLease?.profile_id ||
    tenantSignature?.signer_profile_id
  );

  // Cas 2: Le locataire a-t-il signé le bail?
  const tenantSignedLease = !!(mainTenantFromLease?.signed_at);

  // Cas 3: L'email est-il un placeholder?
  const tenantEmail = mainTenantFromLease?.invited_email || 
                      mainTenantFromLease?.profile?.email ||
                      tenantSignature?.profile?.email;

  const isPlaceholderEmail = tenantEmail && (
    tenantEmail.includes('@a-definir') || 
    tenantEmail.includes('@placeholder') ||
    tenantEmail === 'locataire@a-definir.com'
  );
  
  // Cas 4: Y a-t-il une erreur de données?
  const hasDataError = !tenantHasRealProfile && isPlaceholderEmail;

  // Cas 5: Le bail est-il complètement signé par les 2 parties?
  const leaseFullySigned = !!(ownerSignature?.signed_at && tenantSignedLease && tenantHasRealProfile);

  // Profile ID à utiliser pour l'invitation
  const tenantProfileId = tenantSignature?.signer_profile_id || 
                          mainTenantFromLease?.profile?.id ||
                          mainTenantFromLease?.profile_id;
  
  // Nom du locataire pour l'affichage
  const tenantName = tenantSignature?.profile 
      ? `${tenantSignature.profile.prenom || ''} ${tenantSignature.profile.nom || ''}`.trim()
      : mainTenantFromLease?.profile 
        ? `${mainTenantFromLease.profile.prenom || ''} ${mainTenantFromLease.profile.nom || ''}`.trim()
      : mainTenantFromLease?.invited_name || 
        (isPlaceholderEmail ? "Locataire (non défini)" : tenantEmail) || 
        "Locataire";

  // Signatures complètes (avec image)
  const ownerSigned = !!(ownerSignature?.signed_at && (ownerSignature?.signature_image_path || ownerSignature?.signature_image));
  const tenantSigned = !!(tenantSignature?.signed_at && (tenantSignature?.signature_image_path || tenantSignature?.signature_image));
  const actualSignaturesCount = (edl.edl_signatures || []).filter((s: any) => (s.signature_image_path || s.signature_image) && s.signed_at).length;

  // Debug log pour comprendre les données
  console.log("[EDL Debug]", {
    tenantHasRealProfile,
    tenantSignedLease,
    isPlaceholderEmail,
    hasDataError,
    leaseFullySigned,
    tenantProfileId,
    tenantEmail,
    signers: edl.lease?.signers
  });

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Barre supérieure fixe (Header) */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground hover:text-foreground">
              <Link href="/owner/inspections">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour
              </Link>
            </Button>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-slate-900 hidden sm:block">
                EDL {edl.type === "entree" ? "Entrée" : "Sortie"} - {edl.lease?.property?.ville}
              </h1>
              <Badge className={status.color} variant="outline">
                <StatusIcon className="h-3 w-3 mr-1" />
                {status.label}
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!ownerSigned && edl.status !== "signed" && (
              <Button
                size="sm"
                onClick={() => setIsSignModalOpen(true)}
                disabled={isSigning}
                className="bg-blue-600 hover:bg-blue-700 shadow-sm"
              >
                {isSigning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileSignature className="h-4 w-4 mr-2" />}
                Signer l'EDL
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="hidden sm:flex"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Télécharger
            </Button>
            
            <Button variant="outline" size="sm" onClick={() => window.print()} className="hidden sm:flex">
              <Printer className="h-4 w-4 mr-2" />
              Imprimer
            </Button>
            
            {["draft", "scheduled", "in_progress", "completed"].includes(edl.status) && (
              <Button variant="outline" size="sm" asChild className="bg-white border-slate-200 shadow-sm hover:bg-slate-50">
                <Link href={`/owner/inspections/${edl.id}/edit`}>
                  <Edit className="h-4 w-4 mr-2 text-indigo-600" />
                  Modifier
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Colonne de GAUCHE : L'APERÇU RÉEL DU DOCUMENT */}
          <div className="lg:col-span-8 xl:col-span-9 order-2 lg:order-1">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[800px]">
              <EDLPreview 
                edlData={edlTemplateData} 
                edlId={edl.id} 
              />
            </div>
          </div>

          {/* Colonne de DROITE : Contexte & Signatures */}
          <div className="lg:col-span-4 xl:col-span-3 order-1 lg:order-2 space-y-6">
            
            {/* Carte de Progression */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <ClipboardList className="h-3 w-3 text-blue-500" />
                  Progression de l&apos;inspection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground text-xs font-medium">Éléments inspectés</span>
                    <span className="font-bold text-slate-900 text-xs">
                      {stats.completedItems} / {stats.totalItems}
                    </span>
                  </div>
                  <Progress value={completionPercentage} className="h-2 bg-slate-100" />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {completionPercentage}% complété
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded bg-indigo-50 border border-indigo-100 text-center">
                    <p className="text-[10px] text-indigo-600 font-medium uppercase">Photos</p>
                    <p className="text-xl font-bold text-indigo-700">{stats.totalPhotos}</p>
                  </div>
                  <div className="p-2 rounded bg-green-50 border border-green-100 text-center">
                    <p className="text-[10px] text-green-600 font-medium uppercase">Signatures</p>
                    <p className="text-xl font-bold text-green-700">{actualSignaturesCount} / 2</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Carte des Signatures */}
            <Card className="border-2 border-indigo-100 shadow-sm bg-indigo-50/20 overflow-hidden">
              <CardHeader className="pb-3 border-b border-indigo-50">
                <CardTitle className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                  <FileSignature className="h-4 w-4" />
                  Signatures du document
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Propriétaire */}
                <div className={`p-3 rounded-lg border flex items-center justify-between ${ownerSigned ? "bg-green-50 border-green-200" : "bg-white border-slate-200 shadow-sm"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${ownerSigned ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"}`}>
                      {ownerSigned ? <CheckCircle2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Bailleur</p>
                      <p className="text-[10px] text-muted-foreground">{ownerSigned ? `Signé le ${new Date(ownerSignature.signed_at).toLocaleDateString()}` : "En attente"}</p>
                    </div>
                  </div>
                  {!ownerSigned && (
                    <Button size="sm" variant="ghost" className="text-blue-600 h-7 px-2 text-[10px] hover:bg-blue-50" onClick={() => setIsSignModalOpen(true)}>Signer</Button>
                  )}
                </div>

                {/* Locataire */}
                <div className={`p-3 rounded-lg border flex items-center justify-between ${
                  tenantSigned ? "bg-green-50 border-green-200" : "bg-white border-slate-200 shadow-sm"
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      tenantSigned ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-400"
                    }`}>
                      {tenantSigned ? <CheckCircle2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{tenantName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {tenantSigned 
                          ? `Signé le ${new Date(tenantSignature.signed_at).toLocaleDateString()}` 
                          : tenantSignature?.invitation_sent_at 
                            ? `Invitation envoyée le ${new Date(tenantSignature.invitation_sent_at).toLocaleDateString()}` 
                            : tenantHasRealProfile 
                              ? "En attente d'invitation"
                              : isPlaceholderEmail 
                                ? "Email à définir"
                                : "Non invité"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Bouton d'action - Cas: profil réel disponible */}
                  {!tenantSigned && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-blue-600 h-7 px-2 text-[10px] hover:bg-blue-50"
                      onClick={() => handleSendToTenant(tenantProfileId || null, !tenantProfileId ? tenantEmail : undefined)}
                      disabled={isSending || (isPlaceholderEmail && !tenantProfileId)}
                    >
                      {isSending ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Mail className="h-3 w-3 mr-1" />
                          {tenantSignature?.invitation_sent_at ? "Renvoyer" : "Inviter"}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {isPlaceholderEmail && !tenantHasRealProfile && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 mt-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div className="text-[10px] text-amber-700">
                        <p className="font-bold">Email non défini</p>
                        <p>L&apos;email actuel est un placeholder. Vous devez modifier le bail pour inviter le locataire avec son vrai email.</p>
                        <Link href={`/owner/leases/${edl.lease?.id}/edit`} className="text-blue-600 underline mt-1 block">
                          Modifier le bail
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-slate-500 italic text-center leading-relaxed">
                  L&apos;état des lieux fait partie intégrante du bail. Les deux parties doivent signer pour sceller le document.
                </p>
              </CardContent>
            </Card>

            {/* Détails du Logement */}
            <Card className="border-none shadow-sm bg-white overflow-hidden">
              <CardHeader className="pb-2 border-b border-slate-50">
                <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Home className="h-3 w-3 text-slate-400" />
                  Logement concerné
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex items-start gap-3 text-left">
                  <div className="p-2 rounded bg-slate-50 border border-slate-100 flex-shrink-0">
                    <Home className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-900">{edl.lease?.property?.adresse_complete}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {edl.lease?.property?.code_postal} {edl.lease?.property?.ville}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Compteurs du bien - 🔧 FIX: Utiliser unifiedMetersForDisplay */}
            {unifiedMetersForDisplay.length > 0 && (
              <Card className="border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="pb-2 border-b border-slate-50">
                  <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                    <Home className="h-3 w-3 text-slate-400" />
                    Données techniques
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {unifiedMetersForDisplay.map((meter: any, index: number) => (
                    <div key={meter.id || `meter-${index}`} className="p-2 rounded-lg border border-slate-100 bg-slate-50/50">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[9px] font-bold uppercase text-slate-500">
                          {meter.type === 'electricity' ? 'Électricité' : meter.type === 'gas' ? 'Gaz' : meter.type === 'water' ? 'Eau' : meter.type}
                        </span>
                        <Badge variant={meter.hasReading ? "secondary" : "outline"} className={`text-[8px] h-4 px-1 ${meter.hasReading ? "bg-green-100 text-green-700 border-none" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {meter.hasReading ? "Relevé effectué" : "À relever"}
                        </Badge>
                      </div>
                      <p className="text-[11px] font-medium text-slate-900 leading-none">N° {meter.meter_number || meter.serial_number || "Non renseigné"}</p>
                      {meter.hasReading && meter.readingValue !== null && (
                        <p className="text-[10px] text-blue-600 font-semibold mt-1">{meter.readingValue.toLocaleString('fr-FR')} {meter.readingUnit}</p>
                      )}
                      {meter.location && <p className="text-[9px] text-muted-foreground mt-1 italic">{meter.location}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>

      {/* Modal de Signature */}
      <Dialog open={isSignModalOpen} onOpenChange={setIsSignModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Signature de l&apos;état des lieux</DialogTitle>
            <DialogDescription>
              Veuillez apposer votre signature tactile ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <SignaturePad
              signerName={ownerProfile?.profile?.prenom ? `${ownerProfile.profile.prenom} ${ownerProfile.profile.nom}` : "Bailleur"}
              onSignatureComplete={handleSign}
              disabled={isSigning}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
