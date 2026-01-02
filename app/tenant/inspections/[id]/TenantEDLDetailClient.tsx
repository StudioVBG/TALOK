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

  const { raw: edl, mySignature, meterReadings, ownerProfile, rooms, stats } = data;
  const property = edl.lease?.property || edl.property_details;

  const hasSigned = !!(mySignature?.signed_at && mySignature?.signature_image_path);

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

  const adaptedMeterReadings = (meterReadings || []).map((r: any) => ({
    type: r.meter?.type || "electricity",
    meter_number: r.meter?.serial_number || r.meter?.meter_number,
    reading: String(r.reading_value),
    unit: r.reading_unit || "kWh",
    photo_url: r.photo_path,
  }));

  const adaptedMedia = (edl.edl_media || []).map((m: any) => ({
    id: m.id,
    edl_id: edl.id,
    item_id: m.item_id,
    file_path: m.storage_path,
    type: m.media_type || "photo",
  }));

  const edlTemplateData = mapRawEDLToTemplate(
    edl as any,
    ownerProfile,
    edl.edl_items || [],
    adaptedMedia,
    adaptedMeterReadings,
    adaptedSignatures,
    []
  );

  const handleSignatureSubmit = async (signatureData: SignatureData) => {
    if (!signatureData.data) return;
    try {
      setIsSigning(true);
      const response = await fetch(`/api/edl/${edl.id}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signatureData.data }),
      });
      if (!response.ok) throw new Error("Erreur lors de la signature");
      setIsSignModalOpen(false);
      router.refresh();
    } catch (error: any) {
      alert(error.message);
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
            <Button 
              variant="outline" 
              onClick={handleDownloadPDF}
              className="h-11 px-6 border-slate-200 bg-white hover:bg-slate-50 font-semibold rounded-xl shadow-sm"
            >
              <Download className="h-4 w-4 mr-2" /> Télécharger PDF
            </Button>
          </div>
        </div>

        {/* État de Signature SOTA */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-8 space-y-6">
            <AnimatePresence>
              {!hasSigned && edl.status !== "draft" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                  <GlassCard className="p-6 border-none bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-xl relative overflow-hidden">
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                          <FileSignature className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold">Votre signature est requise</h3>
                          <p className="text-white/80 text-sm">Vérifiez les pièces et les compteurs avant de valider.</p>
                        </div>
                      </div>
                      <Button onClick={() => setIsSignModalOpen(true)} variant="secondary" className="bg-white text-orange-600 hover:bg-slate-50 font-bold">
                        Ouvrir le pad
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aperçu Document Premium */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-bold text-slate-800">Inspection détaillée</h3>
                <Badge variant="outline" className="bg-white/50 border-slate-200">{stats.completedItems} éléments vérifiés</Badge>
              </div>
              <GlassCard className="p-0 border-slate-200 shadow-2xl overflow-hidden bg-white">
                <div className="h-[75vh] overflow-y-auto custom-scrollbar">
                  <EDLPreview edlData={edlTemplateData} />
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

            {/* 2. Relevés de Compteurs */}
            {meterReadings.length > 0 && (
              <GlassCard className="p-6 border-slate-200 bg-white shadow-lg space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Maximize className="h-5 w-5 text-indigo-600" /> Énergie
                </h4>
                <div className="space-y-3">
                  {meterReadings.map((reading: any, i: number) => {
                    const type = reading.meter?.type || "electricity";
                    const Icon = type === "electricity" ? Zap : type === "water" ? Droplet : Flame;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 group hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-slate-400" />
                          <span className="text-sm font-bold text-slate-600 capitalize">{type}</span>
                        </div>
                        <span className="font-black text-slate-900">{reading.reading_value} {reading.reading_unit || "kWh"}</span>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}

            {/* 3. Recapitulatif Technique */}
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
