"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

  console.log("[TenantEDLDetail] Adapted signatures:", JSON.stringify(adaptedSignatures.map(s => ({
    role: s.signer_type,
    hasUrl: !!s.signature_image_url,
    url: s.signature_image_url ? s.signature_image_url.substring(0, 50) + '...' : null,
    signedAt: s.signed_at
  })), null, 2));

  // 🔧 FIX: Utiliser les compteurs des relevés ET ceux du bien pour éviter les doublons
  const recordedMeterIds = new Set((meterReadings || []).map((r: any) => r.meter_id));

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
      alert(error instanceof Error ? error.message : "Erreur lors de la signature");
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/api/edl/${edl.id}/pdf`, "_blank");
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 capitalize">
                EDL {edl.type === 'entree' ? "d'entrée" : "de sortie"}
              </h1>
            </div>
            <p className="text-slate-500 text-lg flex items-center gap-2">
              <Home className="h-4 w-4" /> {property?.adresse_complete || property?.adresse}
            </p>
          </motion.div>

          <div className="flex flex-wrap gap-3">
            {!hasSigned && edl.status !== "draft" && (
              <Button 
                onClick={() => setIsSignModalOpen(true)} 
                disabled={isSigning}
                className="h-11 px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-lg shadow-amber-100 rounded-xl"
              >
                <FileSignature className="h-4 w-4 mr-2" />
                {isSigning ? "Signature..." : "Signer l'EDL"}
              </Button>
            )}
            {/* ✅ Note: Le bouton Télécharger est géré à l'intérieur du composant EDLPreview pour éviter les doublons */}
          </div>
        </div>

        {/* État de Signature SOTA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-6">
            {/* Note: La bannière de signature a été supprimée car redondante avec le bouton du header */}

            {/* Aperçu Document Premium */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-bold text-slate-800">Inspection détaillée</h3>
                <Badge variant="outline" className="bg-white/50 border-slate-200">{stats.completedItems} éléments vérifiés</Badge>
              </div>
              <GlassCard className="p-0 border-slate-200 shadow-2xl overflow-hidden bg-white">
                <div className="h-[75vh] overflow-y-auto custom-scrollbar">
                  <EDLPreview edlData={edlTemplateData} edlId={edl.id} />
                </div>
              </GlassCard>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            {/* 1. Signataires Timeline */}
            <GlassCard className="p-6 border-slate-200 bg-white shadow-lg space-y-6">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-4">
                <ShieldCheck className="h-5 w-5 text-indigo-600" /> Validation
              </h4>
              <div className="space-y-6">
                {(edl.edl_signatures || []).map((sig: any) => {
                  const isSigned = !!sig.signed_at;
                  const isOwner = sig.signer_role === "owner" || sig.signer_role === "proprietaire";
                  return (
                    <div key={sig.id} className="flex items-start gap-4">
                      <div className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
                        isSigned ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-slate-50 text-slate-300 border border-slate-100"
                      )}>
                        {isSigned ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">
                          {sig.profile?.prenom} {sig.profile?.nom || (isOwner ? "Propriétaire" : "Locataire")}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {isOwner ? "Bailleur" : "Locataire"} • {isSigned ? formatDateShort(sig.signed_at) : "En attente"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            {/* 2. Données Techniques (Compteurs & Clés) - Visibilité Totale */}
            <GlassCard className="p-6 border-slate-200 bg-white shadow-lg space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 border-b pb-3">
                <Maximize className="h-5 w-5 text-indigo-600" /> Données techniques
              </h4>
              
              {/* Compteurs */}
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Compteurs du logement</p>
                <div className="grid grid-cols-1 gap-2">
                  {(allPropertyMeters || []).map((meter: any) => {
                    const reading = meterReadings.find(r => r.meter_id === meter.id);
                    const type = meter.type;
                    const Icon = type === "electricity" ? Zap : type === "water" ? Droplet : Flame;
                    
                    return (
                      <div key={meter.id} className="flex flex-col p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-indigo-500" />
                            <span className="text-xs font-bold text-slate-700 capitalize">
                              {type === 'electricity' ? 'Électricité' : type === 'water' ? 'Eau' : 'Gaz'}
                            </span>
                          </div>
                          {reading ? (
                            <span className="text-sm font-black text-slate-900">
                              {reading.reading_value} {reading.reading_unit || meter.unit}
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-700 border-amber-200">
                              À relever
                            </Badge>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-400">N° {meter.meter_number || meter.serial_number || "Non renseigné"}</span>
                          {meter.location && <span className="text-[10px] text-slate-400 italic">{meter.location}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Clés (si présentes) */}
              {(edl.keys && edl.keys.length > 0) && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clés remises</p>
                  <div className="grid grid-cols-1 gap-2">
                    {edl.keys.map((key: any, i: number) => (
                      <div key={i} className="flex items-center justify-between p-2 px-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full bg-indigo-400" />
                          <span className="text-xs font-medium text-slate-700">{key.type}</span>
                        </div>
                        <span className="text-xs font-bold text-indigo-700">x{key.quantite || key.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>

            {/* 3. Recapitulatif (Ancien bloc 3 devenu 4) */}
            <GlassCard className="p-6 border-slate-200 bg-slate-50/50 space-y-4">
              <h4 className="font-bold text-slate-900 flex items-center gap-2 uppercase text-[10px] tracking-[0.2em]">Récapitulatif</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Pièces</span>
                  <span className="font-bold">{rooms.length}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Points vérifiés</span>
                  <span className="font-bold">{stats.completedItems}/{stats.totalItems}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-500">Photos preuves</span>
                  <span className="font-bold">{stats.totalPhotos}</span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Ce document est une copie numérique de l'original signé. La valeur juridique est identique à un document papier.
                  </p>
                </div>
              </div>
            </GlassCard>
          </div>

        </div>
      </div>

      <Dialog open={isSignModalOpen} onOpenChange={setIsSignModalOpen}>
        <DialogContent className="max-w-lg rounded-[2rem] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">Signer l'état des lieux</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              Veuillez apposer votre signature manuscrite pour confirmer les observations notées dans l'EDL.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
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
