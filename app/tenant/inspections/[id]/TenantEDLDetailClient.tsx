"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Home,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Download,
  Zap,
  Droplet,
  Flame,
  Camera,
  User,
  Building2,
  FileSignature,
  Maximize,
  ChevronRight,
  ShieldCheck,
  History,
  Info
} from "lucide-react";
import { formatDateShort, formatCurrency } from "@/lib/helpers/format";
import { EDLPreview } from "@/features/edl/components/edl-preview";
import { mapRawEDLToTemplate } from "@/lib/mappers/edl-to-template";
import { SignaturePad, type SignatureData } from "@/components/signature/SignaturePad";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Breadcrumb } from "@/components/ui/breadcrumb";

interface TenantEDLDetailClientProps {
  data: {
    raw: any;
    mySignature: any;
    meterReadings: any[];
    allPropertyMeters: any[]; // Ajouté
    ownerProfile: any;
    rooms: any[];
    stats: {
      totalItems: number;
      completedItems: number;
      totalPhotos: number;
      signaturesCount: number;
    };
  };
  profileId: string;
}

export default function TenantEDLDetailClient({
  data,
  profileId,
}: TenantEDLDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSigning, setIsSigning] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  const { raw: edl, mySignature, meterReadings, allPropertyMeters, ownerProfile, rooms, stats } = data;
  const property = edl.lease?.property || edl.property_details;

  // ✅ FIX: Plus résilient - On a signé si signed_at est présent ET qu'on a une image (directe ou fallback)
  const hasSigned = !!(mySignature?.signed_at && (mySignature?.signature_image_path || mySignature?.signature_image_url));

  const adaptedSignatures = (edl.edl_signatures || []).map((s: any) => ({
    id: s.id,
    edl_id: edl.id,
    signer_type: s.signer_role,
    signer_profile_id: s.signer_profile_id || s.signer_user,
    signature_image: s.signature_image_path,
    signature_image_url: s.signature_image_url,
    signed_at: s.signed_at,
    ip_address: s.ip_inet,
    profile: s.profile,
  }));

  const recordedMeterIds = new Set((meterReadings || []).map((r: Record<string, unknown>) => r.meter_id));

  // Compteurs avec relevés existants
  const existingReadings = (meterReadings || []).map((r: any) => ({
    type: r.meter?.type || "electricity",
    meter_number: r.meter?.serial_number || r.meter?.meter_number,
    reading: String(r.reading_value),
    unit: r.reading_unit || "kWh",
    photo_url: r.photo_path,
  }));

  // Compteurs du bien sans relevé
  const missingMeters = (allPropertyMeters || [])
    .filter((m: any) => !recordedMeterIds.has(m.id))
    .map((m: any) => ({
      type: m.type || "electricity",
      meter_number: m.meter_number || m.serial_number,
      reading: "Non relevé",
      unit: m.unit || "kWh",
      photo_url: null,
    }));

  const adaptedMeterReadings = [...existingReadings, ...missingMeters];

  const adaptedMedia = (edl.edl_media || []).map((m: any) => ({
    id: m.id,
    edl_id: edl.id,
    item_id: m.item_id,
    file_path: m.storage_path || m.file_path,
    signed_url: m.signed_url,
    type: m.media_type || m.type || "photo",
  }));

  const edlTemplateData = mapRawEDLToTemplate(
    edl as any,
    ownerProfile,
    edl.edl_items || [],
    adaptedMedia,
    adaptedMeterReadings,
    adaptedSignatures,
    edl.keys || []
  );

  const handleSignatureSubmit = async (signatureData: SignatureData) => {
    if (!signatureData.data) return;
    try {
      setIsSigning(true);
      const response = await fetch(`/api/edl/${edl.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: signatureData.data,
          metadata: signatureData.metadata
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la signature");
      }

      setIsSignModalOpen(false);
      router.refresh();
    } catch (error: unknown) {
      toast({ variant: "destructive", title: "Erreur", description: error instanceof Error ? error.message : "Erreur lors de la signature" });
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/edl/${edl.id}/pdf`, "_blank");
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-7xl space-y-4 sm:space-y-6">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "États des lieux", href: "/tenant/inspections" },
            { label: `EDL ${edl.type === "entree" ? "Entrée" : "Sortie"}` }
          ]}
          homeHref="/tenant/dashboard"
        />

        {/* Header SOTA — responsive */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 sm:gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 mb-1.5 sm:mb-2">
              <div className="p-1.5 sm:p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 flex-shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-foreground capitalize">
                EDL {edl.type === 'entree' ? "d'entrée" : "de sortie"}
              </h1>
            </div>
            <p className="text-muted-foreground text-sm sm:text-base md:text-lg flex items-center gap-2 truncate">
              <Home className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{property?.adresse_complete || property?.adresse}</span>
            </p>
          </motion.div>

          <div className="flex flex-wrap gap-2 sm:gap-3 w-full sm:w-auto">
            {!hasSigned && edl.status !== "draft" && (
              <Button 
                onClick={() => setIsSignModalOpen(true)} 
                disabled={isSigning}
                className="h-10 sm:h-11 px-4 sm:px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-100 rounded-xl flex-1 sm:flex-none"
              >
                <FileSignature className="h-4 w-4 mr-2" />
                {isSigning ? "Signature..." : "Signer l'EDL"}
              </Button>
            )}
          </div>
        </div>

        {/* État de Signature SOTA — responsive */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-8">
          
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            {/* Aperçu Document Premium */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between px-1 sm:px-2 gap-2">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-foreground">Inspection détaillée</h3>
                <Badge variant="outline" className="bg-card/50 border-border text-[10px] sm:text-xs flex-shrink-0">{stats.completedItems} éléments</Badge>
              </div>
              <GlassCard className="p-0 border-border shadow-2xl overflow-hidden bg-card">
                <div className="h-[55vh] sm:h-[65vh] lg:h-[75vh] overflow-y-auto custom-scrollbar">
                  <EDLPreview edlData={edlTemplateData} edlId={edl.id} />
                </div>
              </GlassCard>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            {/* 1. Signataires Timeline */}
            <GlassCard className="p-4 sm:p-6 border-border bg-card shadow-lg space-y-4 sm:space-y-6">
              <h4 className="font-bold text-foreground flex items-center gap-2 border-b pb-3 sm:pb-4 text-sm sm:text-base">
                <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" /> Validation
              </h4>
              <div className="space-y-4 sm:space-y-6">
                {(edl.edl_signatures || []).map((sig: any) => {
                  const isSigned = !!sig.signed_at;
                  const isOwner = sig.signer_role === "owner" || sig.signer_role === "proprietaire";
                  return (
                    <div key={sig.id} className="flex items-start gap-3 sm:gap-4">
                      <div className={cn(
                        "h-9 w-9 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0",
                        isSigned ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-muted text-muted-foreground/30 border border-border"
                      )}>
                        {isSigned ? <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /> : <Clock className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-foreground text-xs sm:text-sm truncate">
                          {sig.profile?.prenom} {sig.profile?.nom || (isOwner ? "Propriétaire" : "Locataire")}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          {isOwner ? "Bailleur" : "Locataire"} • {isSigned ? formatDateShort(sig.signed_at) : "En attente"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* 2. Données Techniques (Compteurs & Clés) - Visibilité Totale */}
            <GlassCard className="p-4 sm:p-6 border-border bg-card shadow-lg space-y-4">
              <h4 className="font-bold text-foreground flex items-center gap-2 border-b pb-3 text-sm sm:text-base">
                <Maximize className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" /> Données techniques
              </h4>
              
              {/* Compteurs */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Compteurs du logement</p>
                <div className="grid grid-cols-1 gap-2">
                  {(allPropertyMeters || []).map((meter: any) => {
                    const reading = meterReadings.find(r => r.meter_id === meter.id);
                    const type = meter.type;
                    const Icon = type === "electricity" ? Zap : type === "water" ? Droplet : Flame;
                    
                    return (
                      <div key={meter.id} className="flex flex-col p-3 rounded-xl bg-muted border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-indigo-500" />
                            <span className="text-xs font-bold text-foreground/80 capitalize">
                              {type === 'electricity' ? 'Électricité' : type === 'water' ? 'Eau' : 'Gaz'}
                            </span>
                          </div>
                          {reading ? (
                            <span className="text-sm font-black text-foreground">
                              {reading.reading_value} {reading.reading_unit || meter.unit}
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                              À relever
                            </Badge>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-muted-foreground">N° {meter.meter_number || meter.serial_number || "Non renseigné"}</span>
                          {meter.location && <span className="text-[10px] text-muted-foreground italic">{meter.location}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Clés (si présentes) */}
              {(edl.keys && edl.keys.length > 0) && (
                <div className="space-y-3 pt-3 border-t border-border">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clés remises</p>
                  <div className="grid grid-cols-1 gap-2">
                    {edl.keys.map((key: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 px-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-indigo-400" />
                          <span className="text-xs font-medium text-foreground/80">{key.type}</span>
                        </div>
                        <span className="text-xs font-bold text-indigo-700">x{key.quantite || key.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* 3. Recapitulatif */}
            <GlassCard className="p-4 sm:p-6 border-border bg-muted/50 space-y-3 sm:space-y-4">
              <h4 className="font-bold text-foreground flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">Récapitulatif</h4>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Pièces</span>
                  <span className="font-bold">{rooms.length}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Points vérifiés</span>
                  <span className="font-bold">{stats.completedItems}/{stats.totalItems}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">Photos preuves</span>
                  <span className="font-bold">{stats.totalPhotos}</span>
                </div>
              </div>
              <div className="pt-3 sm:pt-4 border-t border-border">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    Ce document est une copie numérique de l&apos;original signé. La valeur juridique est identique à un document papier.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

        </div>
      </div>

      <Dialog open={isSignModalOpen} onOpenChange={setIsSignModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-2xl sm:rounded-[2rem] border-none shadow-2xl p-4 sm:p-6 md:p-8">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl md:text-2xl font-black text-foreground">Signer l&apos;état des lieux</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground text-xs sm:text-sm">
              Veuillez apposer votre signature manuscrite pour confirmer les observations notées dans l&apos;EDL.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 sm:py-4 md:py-6">
            <SignaturePad
              signerName={`${mySignature?.profile?.prenom || ""} ${mySignature?.profile?.nom || "Locataire"}`.trim()}
              onSignatureComplete={handleSignatureSubmit}
              disabled={isSigning}
            />
          </div>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
