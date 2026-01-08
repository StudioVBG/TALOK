"use client";

import { useTenantData } from "../_data/TenantDataProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateShort } from "@/lib/helpers/format";
import { useState, useEffect } from "react";
import { 
  FileText, 
  Home, 
  User, 
  Clock, 
  FileSignature, 
  MapPin, 
  Maximize, 
  Maximize2,
  Layers, 
  ShieldCheck, 
  Euro,
  Info,
  Calendar,
  Phone,
  Mail,
  Zap,
  Droplet,
  Flame,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Building2,
  Key,
  Gauge,
  Activity,
  ArrowUpRight,
  AlertCircle,
  FolderOpen,
  FileSearch,
  Download,
  ShieldAlert,
  Search,
  Loader2,
  CalendarOff,
  DoorOpen
} from "lucide-react";
import { TenantNoticeWizard } from "@/features/tenant/components/TenantNoticeWizard";
import { DocumentDownloadButton } from "@/components/documents/DocumentDownloadButton";
import { LeasePreview } from "@/components/documents/LeasePreview";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const LEASE_TYPE_LABELS: Record<string, string> = {
  nu: "Location nue",
  meuble: "Location meublée",
  colocation: "Colocation",
  saisonnier: "Location saisonnière",
};

const METER_ICONS: Record<string, any> = {
  electricity: Zap,
  water: Droplet,
  gas: Flame,
};

export default function TenantLeasePage() {
  const { dashboard, refetch } = useTenantData();
  const [activeTab, setActiveTab] = useState("contract");
  const [docs, setDocs] = useState<{
    diagnostics: any[];
    contractual: any[];
    others: any[];
  } | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [showNoticeWizard, setShowNoticeWizard] = useState(false);
  
  useEffect(() => {
    if (dashboard?.lease?.id) {
      setLoadingDocs(true);
      fetch(`/api/tenant/lease/${dashboard.lease.id}/documents`)
        .then(res => res.json())
        .then(data => setDocs(data))
        .catch(err => console.error("Error fetching docs:", err))
        .finally(() => setLoadingDocs(false));
    }
  }, [dashboard?.lease?.id]);

  if (!dashboard) return null;
  const { lease, property } = dashboard;

  if (!lease) {
    return (
      <div className="container mx-auto py-24 text-center">
        <div className="h-20 w-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <FileText className="h-10 w-10 text-slate-300" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Aucun bail actif</h1>
        <p className="text-slate-500 max-w-md mx-auto">
          Vous n'avez pas encore de bail associé à votre compte. 
          Attendez l'invitation de votre propriétaire pour commencer.
        </p>
      </div>
    );
  }

  const signers = lease.lease_signers || [];
  const mySigner = signers.find((s: any) => s.profile_id === dashboard.profile_id);
  const isTenantSigned = mySigner?.signature_status === "signed";
  const isFullySigned = lease.statut === 'active' || lease.statut === 'fully_signed';

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        
        {/* Header SOTA */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200">
                <Home className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mon Logement</h1>
            </div>
            <p className="text-slate-500 text-lg">
              {activeTab === "contract" ? "Contrat de location et loyers." : "Passeport technique et caractéristiques du bien."}
            </p>
          </motion.div>

          <div className="flex flex-wrap gap-3">
            <Tabs defaultValue="contract" onValueChange={setActiveTab} className="bg-slate-100 p-1 rounded-xl border border-slate-200">
              <TabsList className="bg-transparent border-none">
                <TabsTrigger value="contract" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold">📜 Contrat</TabsTrigger>
                <TabsTrigger value="passport" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold">🛠️ Vie Pratique</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Tabs value={activeTab} className="w-full">
          <AnimatePresence mode="wait">
            <TabsContent value="contract" key="contract">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
                
                {/* Colonne Gauche : Détails & Contrat - 5/12 */}
                <div className="lg:col-span-5 space-y-6">
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <GlassCard className={cn(
                      "p-6 border-none shadow-xl relative overflow-hidden",
                      isFullySigned ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white" : "bg-gradient-to-br from-amber-400 to-orange-500 text-white"
                    )}>
                      <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md">
                            {isFullySigned ? <ShieldCheck className="h-6 w-6" /> : <Clock className="h-6 w-6" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold uppercase tracking-widest opacity-80">Statut Juridique</p>
                            <p className="text-2xl font-bold">{isFullySigned ? "Bail Certifié" : "Signature en cours"}</p>
                          </div>
                        </div>
                        {isFullySigned && <CheckCircle2 className="h-8 w-8 opacity-50" />}
                      </div>
                    </GlassCard>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <GlassCard className="p-0 border-slate-200 bg-white shadow-lg overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                          <Euro className="h-5 w-5 text-indigo-600" /> 
                          Synthèse Mensuelle
                        </h3>
                        <Badge variant="outline" className="bg-white">{LEASE_TYPE_LABELS[lease.type_bail] || "Location"}</Badge>
                      </div>
                      <div className="p-6 space-y-4">
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-500 font-medium">Loyer principal</span>
                          <span className="font-bold text-slate-900">{formatCurrency(lease.loyer)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                          <span className="text-slate-500 font-medium">Charges forfaitaires</span>
                          <span className="font-bold text-slate-900">{formatCurrency(lease.charges_forfaitaires)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-indigo-100">
                          <span className="text-lg font-bold text-indigo-600">Loyer CC</span>
                          <span className="text-3xl font-black text-indigo-600">
                            {formatCurrency((lease.loyer || 0) + (lease.charges_forfaitaires || 0))}
                          </span>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                    <GlassCard className="p-6 border-slate-200 bg-white shadow-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                          <FileSignature className="h-5 w-5 text-indigo-600" />
                          Documents du bail
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {!isFullySigned ? (
                          <DocumentDownloadButton 
                            type="lease" 
                            leaseId={lease.id} 
                            label="Bail de location (Original)" 
                            className="w-full h-12 justify-between px-4 rounded-xl border-slate-200 hover:bg-slate-50 font-bold"
                          />
                        ) : (
                          <DocumentDownloadButton 
                            type="lease" 
                            leaseId={lease.id} 
                            signed={true}
                            variant="default"
                            className="w-full h-12 justify-between px-4 bg-slate-900 hover:bg-black text-white rounded-xl shadow-lg font-bold"
                            label="Bail Signé & Certifié"
                          />
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* NOUVEAU : Checklist de Conformité */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <GlassCard className="p-6 border-slate-200 bg-white shadow-lg space-y-6">
                      <div className="flex items-center justify-between border-b pb-4">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                          <ShieldCheck className="h-5 w-5 text-emerald-600" />
                          Conformité du Bail
                        </h3>
                        <Badge className={cn(
                          "font-black uppercase tracking-tighter",
                          isFullySigned ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {isFullySigned ? "Validé" : "En cours"}
                        </Badge>
                      </div>
                      
                      <div className="space-y-4">
                        <CheckItem label="Contrat de bail signé" status={isFullySigned ? 'success' : 'pending'} />
                        <CheckItem label="Dossier Diagnostics (DDT)" status={docs?.diagnostics && docs.diagnostics.length > 0 ? 'success' : 'pending'} />
                        <CheckItem label="Attestation d'assurance" status={dashboard.insurance?.has_insurance ? 'success' : 'pending'} />
                        <CheckItem label="État des lieux d'entrée" status={lease.statut === 'active' ? 'success' : 'pending'} />
                      </div>
                    </GlassCard>
                  </motion.div>

                  {/* Section Donner Congé - Visible uniquement si bail actif */}
                  {lease.statut === 'active' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                      <GlassCard className="p-6 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 rounded-xl">
                              <DoorOpen className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900">Quitter le logement</h3>
                              <p className="text-xs text-slate-500">Donner congé à votre propriétaire</p>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-sm text-slate-600">
                          Vous souhaitez mettre fin à votre bail ? Donnez congé en respectant le préavis légal 
                          de <strong>{lease.type_bail === 'nu' ? '3 mois' : '1 mois'}</strong>.
                        </p>

                        <Button 
                          variant="outline" 
                          className="w-full border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800 font-bold"
                          onClick={() => setShowNoticeWizard(true)}
                        >
                          <CalendarOff className="h-4 w-4 mr-2" />
                          Donner congé
                        </Button>
                      </GlassCard>
                    </motion.div>
                  )}

                  {/* Congé en cours */}
                  {lease.statut === 'notice_given' && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                      <GlassCard className="p-6 border-orange-300 bg-gradient-to-br from-orange-50 to-red-50 shadow-lg space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 rounded-xl">
                            <CalendarOff className="h-5 w-5 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">Congé en cours</h3>
                            <p className="text-xs text-slate-500">Votre préavis est en cours</p>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-white/80 rounded-xl border border-orange-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-600">Fin du bail prévue</span>
                            <span className="font-bold text-orange-700">
                              {lease.date_fin ? formatDateShort(lease.date_fin) : '—'}
                            </span>
                          </div>
                        </div>

                        <p className="text-xs text-slate-500">
                          Pensez à préparer l'état des lieux de sortie et à organiser la remise des clés.
                        </p>
                      </GlassCard>
                    </motion.div>
                  )}

                  {/* NOUVEAU : Annexes & Diagnostics */}
                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <GlassCard className="p-0 border-slate-200 bg-white shadow-lg overflow-hidden">
                      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2">
                          <FolderOpen className="h-5 w-5 text-indigo-600" />
                          Annexes & Diagnostics
                        </h3>
                        {loadingDocs && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
                      </div>
                      <div className="divide-y divide-slate-50">
                        {docs?.diagnostics.map((doc: any) => (
                          <div key={doc.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-50 rounded-lg group-hover:bg-amber-100 transition-colors">
                                <Gauge className="h-4 w-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{doc.title || doc.type}</p>
                                <p className="text-[10px] text-slate-400 font-medium">Diagnostic Technique</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 text-indigo-600 font-bold" asChild>
                              <a href={`/api/documents/view?path=${doc.storage_path}`} target="_blank">
                                <Maximize2 className="h-4 w-4 mr-1" /> Voir
                              </a>
                            </Button>
                          </div>
                        ))}
                        {docs?.contractual.filter((d: any) => !d.type?.toLowerCase().includes("bail")).map((doc: any) => (
                          <div key={doc.id} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                <FileText className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-slate-900">{doc.title || doc.type}</p>
                                <p className="text-[10px] text-slate-400 font-medium capitalize">{doc.type}</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-8 text-indigo-600 font-bold" asChild>
                              <a href={`/api/documents/view?path=${doc.storage_path}`} target="_blank">
                                <Maximize2 className="h-4 w-4 mr-1" /> Voir
                              </a>
                            </Button>
                          </div>
                        ))}
                        {(!docs || (docs.diagnostics.length === 0 && docs.contractual.length === 0)) && !loadingDocs && (
                          <div className="p-8 text-center">
                            <FileSearch className="h-8 w-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-sm text-slate-400 font-medium">Aucune annexe répertoriée.</p>
                          </div>
                        )}
                      </div>
                    </GlassCard>
                  </motion.div>
      </div>

                <div className="lg:col-span-7">
                  <GlassCard className="p-0 border-slate-200 shadow-2xl overflow-hidden bg-white h-full min-h-[600px]">
                    <div className="p-4 border-b bg-slate-50 flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Aperçu du contrat interactif</p>
                      <Badge className="bg-indigo-50 text-indigo-600 border-indigo-100">Lecture seule</Badge>
              </div>
                    <LeasePreview leaseId={lease.id} />
                  </GlassCard>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="passport" key="passport">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
                
                {/* 1. Carte Identité du Bien - 4/12 */}
                <div className="lg:col-span-4 space-y-6">
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                    <GlassCard className="p-6 border-slate-200 bg-white shadow-xl space-y-6">
                      <div className="flex items-center gap-4 border-b pb-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-slate-900">Le Logement</h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Identité Technique</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Adresse</p>
                            <p className="font-bold text-slate-900 leading-tight">{property?.adresse_complete}</p>
                            <p className="text-sm text-slate-500">{property?.code_postal} {property?.ville}</p>
                          </div>
                          <MapPin className="h-5 w-5 text-indigo-200" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Surface</p>
                            <p className="font-bold text-slate-900">{property?.surface || "—"} m²</p>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Pièces</p>
                            <p className="font-bold text-slate-900">{property?.nb_pieces || "—"}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Étage</p>
                            <p className="font-bold text-slate-900">{property?.etage || "RDC"}</p>
                          </div>
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Ascenseur</p>
                            <p className="font-bold text-slate-900">{property?.ascenseur ? "Oui" : "Non"}</p>
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>

                  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                    <GlassCard className="p-6 border-slate-200 bg-white shadow-xl space-y-4">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="h-5 w-5 text-indigo-600" />
                        Accès & Sécurité
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                              <Key className="h-4 w-4 text-indigo-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Digicode</span>
                          </div>
                          <span className="font-mono font-black text-indigo-600 tracking-widest">{property?.digicode || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                              <Phone className="h-4 w-4 text-slate-400" />
                            </div>
                            <span className="text-sm font-bold text-slate-700">Interphone</span>
                          </div>
                          <span className="text-sm font-bold text-slate-900">{property?.interphone || "—"}</span>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                </div>

                {/* 2. Inventaire Technique EDL - 8/12 */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {/* Compteurs */}
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
                    <div className="flex items-center justify-between mb-4 px-2">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-indigo-600" /> Relevés de Compteurs
                      </h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Source : États des lieux</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {property?.meters && property.meters.length > 0 ? (
                        property.meters.map((m: any) => {
                          const Icon = METER_ICONS[m.type] || Gauge;
                          return (
                            <GlassCard key={m.id} className="p-5 border-slate-200 bg-white hover:shadow-xl transition-all">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-3 bg-slate-50 rounded-2xl">
                                    <Icon className="h-5 w-5 text-slate-600" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900 capitalize">{m.type}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">N° {m.serial_number}</p>
                                  </div>
                                </div>
                                <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                              </div>
                              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex justify-between items-end">
                                <div>
                                  <p className="text-[10px] font-bold text-indigo-400 uppercase mb-1">Index Initial</p>
                                  <p className="text-2xl font-black text-indigo-600">{m.last_reading_value || "—"}</p>
                                </div>
                                <span className="text-xs font-bold text-indigo-400">{m.unit}</span>
                              </div>
                              {m.last_reading_date && (
                                <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1.5 font-medium italic">
                                  <Calendar className="h-3 w-3" /> Relevé certifié le {formatDateShort(m.last_reading_date)}
                                </p>
                              )}
                            </GlassCard>
                          );
                        })
                      ) : (
                        <GlassCard className="col-span-2 p-8 text-center border-dashed border-2 border-slate-200 bg-slate-50/50">
                          <Gauge className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                          <p className="text-slate-500 font-medium">Les relevés de compteurs seront disponibles après la signature de l'EDL d'entrée.</p>
                        </GlassCard>
                      )}
                    </div>
                  </motion.div>

                  {/* Clés & Équipements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                      <GlassCard className="p-6 border-slate-200 bg-white shadow-lg h-full">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6">
                          <Key className="h-5 w-5 text-indigo-600" />
                          Jeux de Clés (Trousseau)
                        </h3>
                        <div className="space-y-3">
                          {property?.keys && property.keys.length > 0 ? (
                            property.keys.map((k: any, i: number) => (
                              <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <span className="text-sm font-bold text-slate-700">{k.label}</span>
                                <Badge className="bg-indigo-600 text-white font-black">{k.count_info}</Badge>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-slate-400 italic">Détail des clés non encore historisé.</p>
                          )}
            </div>
                      </GlassCard>
                    </motion.div>

                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                      <GlassCard className="p-6 border-slate-200 bg-white shadow-lg h-full relative overflow-hidden">
                        <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-6">
                          <Activity className="h-5 w-5 text-indigo-600" />
                          Performances (DPE)
                        </h3>
                        <div className="flex gap-4">
                          <div className="flex-1 space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Énergie</p>
                            <div className={cn(
                              "h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg",
                              property?.dpe_classe_energie === 'A' ? "bg-emerald-500" :
                              property?.dpe_classe_energie === 'B' ? "bg-green-500" :
                              property?.dpe_classe_energie === 'C' ? "bg-lime-500" :
                              property?.dpe_classe_energie === 'D' ? "bg-yellow-500" :
                              property?.dpe_classe_energie === 'E' ? "bg-orange-500" :
                              property?.dpe_classe_energie === 'F' ? "bg-red-500" : "bg-slate-200"
                            )}>
                              {property?.dpe_classe_energie || "—"}
            </div>
            </div>
                          <div className="flex-1 space-y-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Climat (GES)</p>
                            <div className={cn(
                              "h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-lg",
                              property?.dpe_classe_climat === 'A' ? "bg-indigo-300" :
                              property?.dpe_classe_climat === 'B' ? "bg-indigo-400" :
                              property?.dpe_classe_climat === 'C' ? "bg-indigo-500" :
                              property?.dpe_classe_climat === 'D' ? "bg-indigo-600" :
                              property?.dpe_classe_climat === 'E' ? "bg-indigo-700" :
                              property?.dpe_classe_climat === 'F' ? "bg-indigo-800" : "bg-slate-200"
                            )}>
                              {property?.dpe_classe_climat || "—"}
            </div>
            </div>
            </div>
                        <p className="text-[10px] text-slate-400 mt-6 leading-relaxed bg-slate-50 p-3 rounded-xl">
                          Le Diagnostic de Performance Énergétique (DPE) renseigne sur la performance énergétique d'un logement et son impact gaz à effet de serre.
                        </p>
                      </GlassCard>
                    </motion.div>
            </div>

                  {/* Note de Responsabilité SOTA */}
                  <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} className="p-6 bg-indigo-950 text-white rounded-3xl relative overflow-hidden shadow-2xl">
                    <div className="relative z-10 flex items-center justify-between">
                      <div className="space-y-1">
                        <h4 className="text-xl font-bold">Document de Référence</h4>
                        <p className="text-indigo-200 text-sm max-w-md">
                          Cette fiche technique constitue le Passeport du Logement. Elle est extraite des documents contractuels signés (Bail, EDL) et ne peut être modifiée unilatéralement.
                        </p>
                      </div>
                      <ShieldCheck className="h-16 w-16 text-indigo-500 opacity-30" />
            </div>
                    <div className="absolute -right-10 -bottom-10 h-40 w-40 bg-white/5 rounded-full blur-3xl" />
                  </motion.div>

              </div>
              </div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>

        {/* Wizard de congé */}
        {lease && (
          <TenantNoticeWizard
            leaseId={lease.id}
            open={showNoticeWizard}
            onOpenChange={setShowNoticeWizard}
            onSuccess={() => {
              refetch?.();
            }}
          />
        )}

      </div>
    </PageTransition>
  );
}

function CheckItem({ label, status }: { label: string, status: 'success' | 'pending' | 'error' }) {
  return (
    <div className="flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <div className={cn(
          "p-1.5 rounded-full transition-colors",
          status === 'success' ? "bg-emerald-100 text-emerald-600" : 
          status === 'error' ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-300"
        )}>
          {status === 'success' ? <CheckCircle2 className="h-4 w-4" /> : 
           status === 'error' ? <AlertCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
        </div>
        <span className={cn(
          "text-sm font-bold transition-colors",
          status === 'success' ? "text-slate-900" : "text-slate-400"
        )}>
          {label}
        </span>
      </div>
      {status === 'success' ? (
        <Badge variant="ghost" className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0">Conforme</Badge>
      ) : (
        <Badge variant="ghost" className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-2 py-0">En attente</Badge>
      )}
    </div>
  );
}
