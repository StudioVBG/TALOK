"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardCheck,
  Calendar,
  Home,
  FileSignature,
  Eye,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Clock,
  Loader2,
  FileText,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateShort } from "@/lib/helpers/format";
import Link from "next/link";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function TenantInspectionsPage() {
  const [edlList, setEdlList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchEDLs() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();

        if (!profile) return;

        const { data: signatures } = await supabase
          .from("edl_signatures")
          .select(`
            *,
            edl:edl_id(
              *,
              lease:lease_id(*, property:properties(*)),
              property_details:property_id(*)
            )
          `)
          .eq("signer_profile_id", profile.id);

        const formatted = signatures
          ?.filter((sig: any) => sig.edl)
          .map((sig: any) => ({
            id: sig.edl.id,
            type: sig.edl.type,
            status: sig.edl.status,
            scheduled_at: sig.edl.scheduled_at,
            created_at: sig.edl.created_at,
            invitation_token: sig.invitation_token,
            property: sig.edl.lease?.property || sig.edl.property_details,
            isSigned: !!sig.signed_at,
            needsMySignature: !sig.signed_at && sig.edl.status !== "draft",
          })) || [];

        setEdlList(formatted.sort((a, b) => b.needsMySignature ? 1 : -1));
      } finally {
        setIsLoading(false);
      }
    }
    fetchEDLs();
  }, []);

  const pendingCount = edlList.filter(e => e.needsMySignature).length;

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <ClipboardCheck className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">États des Lieux</h1>
            </div>
            <p className="text-slate-500 text-lg">
              Historique technique et vérification de votre logement.
            </p>
          </motion.div>

          <AnimatePresence>
            {pendingCount > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} 
                animate={{ opacity: 1, scale: 1 }}
                className="bg-amber-50 text-amber-700 px-4 py-2 rounded-2xl border border-amber-100 shadow-sm flex items-center gap-2"
              >
                <AlertCircle className="h-5 w-5" />
                <span className="font-bold text-sm">{pendingCount} signature{pendingCount > 1 ? 's' : ''} en attente</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24"><Loader2 className="animate-spin h-10 w-10 text-indigo-600" /></div>
        ) : edlList.length === 0 ? (
          <GlassCard className="p-12 text-center border-slate-200">
            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <ClipboardCheck className="h-10 w-10 text-slate-200" />
            </div>
            <h3 className="text-xl font-bold">Aucun état des lieux</h3>
            <p className="text-slate-500 mt-2 max-w-sm mx-auto">
              Les documents apparaîtront ici dès que votre propriétaire aura programmé l'entrée ou la sortie.
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {edlList.map((edl, index) => (
              <motion.div 
                key={edl.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <GlassCard className={cn(
                  "p-0 border-slate-200 bg-white hover:shadow-xl transition-all duration-300 group overflow-hidden",
                  edl.needsMySignature && "border-amber-200 ring-2 ring-amber-100 ring-opacity-50"
                )}>
                  <div className="flex flex-col md:flex-row items-stretch md:items-center">
                    {/* Badge Type vertical sur mobile, horizontal sur desktop */}
                    <div className={cn(
                      "md:w-3 w-full",
                      edl.type === 'entree' ? "bg-emerald-500" : "bg-orange-500"
                    )} />
                    
                    <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-3 rounded-2xl",
                          edl.type === 'entree' ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600"
                        )}>
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-lg text-slate-900 capitalize">
                              EDL {edl.type === 'entree' ? "d'entrée" : "de sortie"}
                            </h3>
                            <StatusBadge 
                              status={edl.needsMySignature ? "À Signer" : edl.status}
                              type={edl.needsMySignature ? "warning" : (edl.status === 'signed' ? 'success' : 'info')}
                              className="text-[10px] h-5"
                            />
                          </div>
                          <p className="text-slate-500 text-sm flex items-center gap-1.5">
                            <Home className="h-3.5 w-3.5" /> {edl.property?.adresse_complete}
                          </p>
                          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mt-2 flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" /> 
                            {formatDateShort(edl.scheduled_at || edl.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <Button 
                          asChild
                          variant={edl.needsMySignature ? "default" : "outline"}
                          className={cn(
                            "h-11 px-6 font-bold shadow-lg transition-all rounded-xl",
                            edl.needsMySignature 
                              ? "bg-amber-500 hover:bg-amber-600 shadow-amber-100" 
                              : "border-slate-200 hover:bg-indigo-50 hover:text-indigo-600"
                          )}
                        >
                          <Link href={edl.needsMySignature ? `/signature-edl/${edl.invitation_token}` : `/tenant/inspections/${edl.id}`}>
                            {edl.needsMySignature ? "Signer l'EDL" : "Consulter"}
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}

        {/* Note informative SOTA */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="mt-8 p-6 bg-slate-50 rounded-3xl border border-slate-100 flex items-start gap-4">
          <Info className="h-6 w-6 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-slate-900">Pourquoi l'état des lieux est-il crucial ?</p>
            <p className="text-sm text-slate-500 leading-relaxed">
              C'est le seul document qui protège votre dépôt de garantie. En cas de litige, seul l'EDL comparé à la sortie fait foi. 
              <strong> Astuce :</strong> Prenez vos propres photos pendant l'EDL et uploadez-les dans vos documents personnels.
            </p>
          </div>
        </motion.div>

      </div>
    </PageTransition>
  );
}
