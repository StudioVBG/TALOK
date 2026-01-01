"use client";

import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useTenantData } from "../_data/TenantDataProvider";
import { Badge } from "@/components/ui/badge";
import { 
  FileSignature, 
  Clock, 
  CheckCircle2, 
  History, 
  ShieldCheck, 
  ArrowRight, 
  Download,
  AlertCircle,
  FileCheck,
  ChevronRight,
  PartyPopper,
  Sparkles
} from "lucide-react";
import { formatDateShort } from "@/lib/helpers/format";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { DocumentDownloadButton } from "@/components/documents/DocumentDownloadButton";
import Link from "next/link";

// Formateur de rôle pour éviter les underscores
const formatRole = (role: string) => {
  const roles: Record<string, string> = {
    locataire_principal: "Locataire Principal",
    proprietaire: "Bailleur / Propriétaire",
    colocataire: "Colocataire",
    garant: "Garant"
  };
  return roles[role] || role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');
};

export default function TenantSignaturesPage() {
  const { dashboard } = useTenantData();
  const [profile, setProfile] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from("profiles").select("id").eq("user_id", user.id).single();
        setProfile(data);
      }
    }
    getProfile();
  }, []);

  const signers = dashboard?.lease?.lease_signers ?? [];
  const mySignature = signers.find((signer: any) => signer.profile_id === profile?.id);
  const pendingSigners = signers.filter((signer: any) => signer.signature_status !== "signed");
  const signedSigners = signers.filter((signer: any) => signer.signature_status === "signed");
  const isFullySigned = pendingSigners.length === 0 && signers.length > 0;

  if (!dashboard) return null;

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
                <FileSignature className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Signatures</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Validation et authentification de vos documents officiels.
            </p>
          </motion.div>

          {isFullySigned && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl border border-emerald-100 shadow-sm"
            >
              <ShieldCheck className="h-5 w-5" />
              <span className="font-bold text-sm">Tous les documents sont certifiés</span>
            </motion.div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Colonne Gauche : Statut Actuel - 7/12 */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Votre signature personnelle */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <GlassCard className={`overflow-hidden border-none shadow-xl ${
                mySignature?.signature_status === "signed" 
                  ? "bg-gradient-to-br from-slate-900 to-slate-800 text-white" 
                  : "bg-white border-blue-200"
              }`}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <History className="h-5 w-5 opacity-70" />
                      Votre engagement
                    </h3>
                    <Badge variant={mySignature?.signature_status === "signed" ? "default" : "secondary"} className={
                      mySignature?.signature_status === "signed" ? "bg-emerald-500 hover:bg-emerald-600" : ""
                    }>
                      {mySignature?.signature_status === "signed" ? "Validé ✅" : "En attente"}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
                    <div>
                      <p className="font-bold text-xl mb-1">Bail de location</p>
                      <p className={`text-sm ${mySignature?.signature_status === "signed" ? "text-white/60" : "text-slate-500"}`}>
                        {mySignature?.signature_status === "signed"
                          ? `Signé électroniquement le ${mySignature.signed_at ? formatDateShort(mySignature.signed_at) : "—"}`
                          : "Une signature est requise pour valider votre entrée."}
                      </p>
                    </div>
                    {mySignature?.signature_status !== "signed" && (
                      <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20" asChild>
                        <Link href="/app/tenant/onboarding/sign">Signer <ArrowRight className="ml-2 h-4 w-4" /></Link>
                      </Button>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>

            {/* 2. Historique complet des signatures (Timeline) */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-slate-800">Parcours de signature</h3>
              </div>
              
              <GlassCard className="p-6 bg-white border-slate-200 shadow-lg">
                <div className="space-y-8 relative">
                  {/* Ligne verticale de la timeline */}
                  <div className="absolute left-6 top-2 bottom-2 w-0.5 bg-slate-100" />

                  {signers.map((signer: any, index: number) => (
                    <div key={signer.id} className="relative flex items-start gap-6 group">
                      <div className={`z-10 h-12 w-12 rounded-2xl flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${
                        signer.signature_status === 'signed' 
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-100" 
                          : "bg-slate-50 text-slate-400 border border-slate-100"
                      }`}>
                        {signer.signature_status === 'signed' ? <CheckCircle2 className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-bold text-slate-900">{signer.profile?.prenom} {signer.profile?.nom}</p>
                          {signer.signed_at && (
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              {formatDateShort(signer.signed_at)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {formatRole(signer.role)}
                          </p>
                          {signer.signature_status === 'signed' && (
                            <span className="text-[10px] text-emerald-600 font-bold">Identité vérifiée</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Colonne Droite : Succès & Document - 5/12 */}
          <div className="lg:col-span-5">
            <AnimatePresence>
              {isFullySigned ? (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                  <GlassCard className="bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-none p-8 shadow-2xl relative overflow-hidden">
                    <div className="relative z-10 space-y-6">
                      <div className="h-16 w-16 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md shadow-inner">
                        <PartyPopper className="h-8 w-8 text-white" />
                      </div>
                      
                      <div>
                        <h2 className="text-2xl font-bold mb-2">Félicitations !</h2>
                        <p className="text-white/80 leading-relaxed">
                          Toutes les parties ont signé le bail. Votre dossier est désormais 100% complet et certifié légalement.
                        </p>
                      </div>

                      <div className="space-y-3 pt-4">
                        <DocumentDownloadButton 
                          type="lease" 
                          leaseId={dashboard.lease?.id} 
                          signed={true}
                          variant="secondary"
                          className="w-full h-14 text-lg font-bold bg-white text-indigo-600 hover:bg-slate-50 shadow-xl border-none"
                          label="Télécharger le Bail Signé"
                        />
                        <p className="text-center text-[10px] text-white/50 uppercase tracking-[0.2em] font-bold">
                          Document avec preuve cryptographique
                        </p>
                      </div>
                    </div>
                    
                    {/* Décorations visuelles */}
                    <Sparkles className="absolute -right-4 -top-4 h-32 w-32 text-white/10 rotate-12" />
                    <div className="absolute -left-10 -bottom-10 h-40 w-40 bg-white/5 rounded-full blur-3xl" />
                  </GlassCard>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
                  <GlassCard className="p-8 border-slate-200 bg-white shadow-xl text-center space-y-6">
                    <div className="h-20 w-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                      <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">En attente de signature</h2>
                      <p className="text-slate-500 mt-2 text-sm">
                        Le document sera certifié et téléchargeable dès que tous les signataires auront apposé leur signature.
                      </p>
                    </div>
                    <div className="pt-4 space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span>Progression</span>
                        <span>{signedSigners.length} / {signers.length}</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-amber-500" 
                          initial={{ width: 0 }}
                          animate={{ width: `${(signedSigners.length / signers.length) * 100}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aide Contextuelle */}
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-bold text-slate-800">Signature Sécurisée</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                Nous utilisons un protocole de signature électronique conforme à la norme eIDAS. 
                Chaque signature est horodatée et accompagnée d'un dossier de preuve cryptographique incluant votre adresse IP et vos informations d'identité.
              </p>
            </div>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}
