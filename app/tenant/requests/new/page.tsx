"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft, 
  Send, 
  Wrench, 
  Droplet, 
  Zap, 
  Thermometer, 
  Lock, 
  HelpCircle, 
  Sparkles,
  ChevronLeft,
  MessageCircle,
  AlertCircle,
  CheckCircle2,
  Loader2
} from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { useTenantData } from "../../_data/TenantDataProvider";
import { TomTicketCreator } from "@/components/ai/tom-ticket-creator";
import { CreateTicketArgs } from "@/lib/ai/tools-schema";
import { cn } from "@/lib/utils";
import { PageTransition } from "@/components/ui/page-transition";
import { GlassCard } from "@/components/ui/glass-card";
import { motion, AnimatePresence } from "framer-motion";

const categories = [
  { value: "plomberie", label: "Plomberie", icon: Droplet, color: "text-blue-500", bgColor: "bg-blue-50" },
  { value: "electricite", label: "Électricité", icon: Zap, color: "text-amber-500", bgColor: "bg-amber-50" },
  { value: "chauffage", label: "Chauffage", icon: Thermometer, color: "text-red-500", bgColor: "bg-red-50" },
  { value: "serrurerie", label: "Serrurerie", icon: Lock, color: "text-slate-700", bgColor: "bg-slate-100" },
  { value: "autre", label: "Autre", icon: HelpCircle, color: "text-slate-400", bgColor: "bg-slate-50" },
];

const priorities = [
  { value: "basse", label: "Basse", description: "Peut attendre" },
  { value: "normale", label: "Normale", description: "Dans la semaine" },
  { value: "haute", label: "Haute", description: "Urgent" },
];

export default function NewTenantRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { dashboard } = useTenantData();
  const [mode, setMode] = useState<'classic' | 'tom'>('tom');
  const [loading, setLoading] = useState(false);

  // 🔧 FIX: Protection contre dashboard null ou structure inattendue
  const propertyId = dashboard?.lease?.property_id || (dashboard?.leases && dashboard.leases.length > 0 ? dashboard.leases[0].property_id : null);

  const [form, setForm] = useState({
    titre: "",
    description: "",
    categorie: "",
    priorite: "normale",
  });

  const handleTomTicketCreated = async (args: CreateTicketArgs) => {
    if (!propertyId) {
      toast({
        title: "Erreur",
        description: "Impossible d'identifier votre logement.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          titre: args.titre,
          description: args.description,
          priorite: args.priorite,
          categorie: "autre",
          property_id: propertyId,
        }),
      });

      if (!response.ok) throw new Error("Erreur");

      toast({
        title: "Demande créée !",
        description: "Votre ticket a été créé et qualifié par Tom.",
      });
      
      setTimeout(() => router.push("/tenant/requests"), 1500);
    } catch (error) {
      toast({
         title: "Erreur",
         description: "Erreur lors de la création du ticket.",
         variant: "destructive"
      });
    } finally {
        setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titre || !form.description || !form.categorie) {
      toast({ title: "Champs manquants", description: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" });
      return;
    }

    if (!propertyId) {
      toast({
        title: "Erreur",
        description: "Impossible d'identifier votre logement.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          property_id: propertyId,
        }),
      });
      
      if (!response.ok) throw new Error("Erreur");

      toast({ title: "Demande envoyée", description: "Votre ticket est en cours de traitement." });
      router.push("/tenant/requests");
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de créer la demande", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageTransition>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <Link 
              href="/tenant/requests" 
              className="group text-sm font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-2 transition-colors"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 group-hover:bg-indigo-50 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </div>
              Retour aux demandes
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900">Nouvelle Demande</h1>
              <p className="text-slate-500 text-lg mt-1">Comment pouvons-nous vous aider aujourd'hui ?</p>
            </div>
          </div>

          {/* Switch Mode SOTA */}
          <div className="bg-slate-100 p-1.5 rounded-2xl flex border border-slate-200 shadow-inner">
            <button 
              onClick={() => setMode('tom')}
              className={cn(
                "px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2",
                mode === 'tom' 
                  ? "bg-white shadow-lg text-indigo-600" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <Sparkles className={cn("h-4 w-4", mode === 'tom' ? "text-amber-500" : "text-slate-400")} />
              Assistant Tom
            </button>
            <button 
              onClick={() => setMode('classic')}
              className={cn(
                "px-6 py-2.5 text-sm font-bold rounded-xl transition-all",
                mode === 'classic' 
                  ? "bg-white shadow-lg text-slate-900" 
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              Classique
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Content Area */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {mode === 'tom' ? (
                <motion.div 
                  key="tom"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-[2.5rem] border-2 border-indigo-50 shadow-2xl overflow-hidden"
                >
                  <div className="bg-indigo-600 p-8 text-white">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 bg-white/20 rounded-[2rem] flex items-center justify-center backdrop-blur-md">
                        <MessageCircle className="h-8 w-8 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black">Parlez à Tom</h2>
                        <p className="text-white/70">L'IA qui qualifie vos demandes en quelques secondes.</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 md:p-8">
                    <TomTicketCreator onTicketCreated={handleTomTicketCreated} />
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="classic"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <GlassCard className="p-8 border-slate-200 bg-white shadow-2xl space-y-8">
                    <div className="flex items-center gap-4 border-b pb-6">
                      <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <Wrench className="h-6 w-6 text-indigo-600" />
                      </div>
                      <h3 className="text-xl font-bold text-slate-900">Formulaire de demande</h3>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                      <div className="space-y-3">
                        <Label htmlFor="titre" className="text-xs font-black uppercase tracking-widest text-slate-400">Objet de la demande</Label>
                        <Input 
                          id="titre" 
                          placeholder="Ex: Robinet qui fuit, Problème de serrure..." 
                          value={form.titre} 
                          onChange={(e) => setForm({ ...form, titre: e.target.value })} 
                          className="h-14 rounded-2xl border-slate-200 focus:ring-indigo-500 font-bold text-lg"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Catégorie</Label>
                          <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
                            <SelectTrigger className="h-14 rounded-2xl border-slate-200 font-bold">
                              <SelectValue placeholder="Sélectionner..." />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-2xl">
                              {categories.map((cat) => (
                                <SelectItem key={cat.value} value={cat.value} className="h-12 focus:bg-indigo-50 rounded-xl">
                                  <div className="flex items-center gap-3">
                                    <cat.icon className={cn("h-4 w-4", cat.color)} />
                                    <span className="font-bold">{cat.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Degré d'urgence</Label>
                          <div className="flex gap-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-100">
                            {priorities.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => setForm({ ...form, priorite: p.value })}
                                className={cn(
                                  "flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                                  form.priorite === p.value 
                                    ? "bg-white shadow-sm text-indigo-600 ring-1 ring-indigo-100" 
                                    : "text-slate-400 hover:text-slate-600"
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-slate-400">Détails de l'intervention</Label>
                        <Textarea 
                          id="description" 
                          placeholder="Veuillez décrire le problème, sa localisation et si possible les circonstances..." 
                          value={form.description} 
                          onChange={(e) => setForm({ ...form, description: e.target.value })} 
                          className="rounded-3xl border-slate-200 focus:ring-indigo-500 min-h-[200px] p-6 text-lg"
                        />
                      </div>

                      <Button 
                        type="submit" 
                        disabled={loading} 
                        className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xl rounded-2xl shadow-xl shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        {loading ? <Loader2 className="animate-spin h-6 w-6" /> : (
                          <>Envoyer la demande <Send className="ml-3 h-5 w-5" /></>
                        )}
                      </Button>
                    </form>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar Tips */}
          <div className="lg:col-span-4 space-y-6">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <GlassCard className="p-6 border-slate-200 bg-amber-50/50 space-y-4">
                <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <h4 className="font-bold text-slate-900">En cas d'urgence vitale</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Si votre sécurité est menacée (incendie, fuite de gaz majeure, effondrement), contactez immédiatement les pompiers (18) ou le SAMU (15) avant de créer un ticket.
                </p>
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <GlassCard className="p-6 border-slate-200 bg-white shadow-lg space-y-4">
                <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <h4 className="font-bold text-slate-900">Prise en charge rapide</h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ajouter une description précise permet à votre bailleur de mandater le bon prestataire dès le premier passage.
                </p>
                <div className="pt-2">
                  <Badge variant="outline" className="bg-slate-50 border-slate-100 text-[10px] uppercase font-bold tracking-widest text-slate-400">
                    SLA Moyen : 48h
                  </Badge>
                </div>
              </GlassCard>
            </motion.div>
          </div>

        </div>
      </div>
    </PageTransition>
  );
}
