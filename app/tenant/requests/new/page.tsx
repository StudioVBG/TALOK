"use client";

import { useState, useEffect, useCallback } from "react";
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
  Loader2,
  ImagePlus,
  X
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
  { value: "serrurerie", label: "Serrurerie", icon: Lock, color: "text-foreground/80", bgColor: "bg-muted" },
  { value: "autre", label: "Autre", icon: HelpCircle, color: "text-muted-foreground", bgColor: "bg-muted" },
];

const priorities = [
  { value: "basse", label: "Basse", description: "Peut attendre" },
  { value: "normale", label: "Normale", description: "Dans la semaine" },
  { value: "haute", label: "Haute", description: "Urgent" },
];

const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,application/pdf";
const DRAFT_STORAGE_KEY = "tenant_request_draft";

export default function NewTenantRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { dashboard } = useTenantData();
  const [mode, setMode] = useState<'classic' | 'tom'>('tom');
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // 🔧 FIX: Protection contre dashboard null ou structure inattendue
  const propertyId = dashboard?.lease?.property_id || (dashboard?.leases && dashboard.leases.length > 0 ? dashboard.leases[0].property_id : null);

  const [form, setForm] = useState({
    titre: "",
    description: "",
    categorie: "",
    priorite: "normale",
  });

  // Brouillon : restauration au montage (une seule fois)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(DRAFT_STORAGE_KEY) : null;
      if (raw) {
        const draft = JSON.parse(raw) as Partial<typeof form>;
        if (draft && (draft.titre || draft.description || draft.categorie)) {
          setForm((prev) => ({
            titre: draft.titre ?? prev.titre,
            description: draft.description ?? prev.description,
            categorie: draft.categorie ?? prev.categorie,
            priorite: draft.priorite ?? prev.priorite,
          }));
          toast({ title: "Brouillon restauré", description: "Votre brouillon a été rechargé." });
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    } catch {
      // ignore
    }
  }, []);

  // Brouillon : sauvegarde à chaque changement (mode classique uniquement)
  useEffect(() => {
    if (mode !== "classic") return;
    try {
      if (form.titre || form.description || form.categorie) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }, [mode, form]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setForm({ titre: "", description: "", categorie: "", priorite: "normale" });
    toast({ title: "Brouillon effacé", description: "Le formulaire a été réinitialisé." });
  }, [toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const file of selected) {
      if (files.length + valid.length >= MAX_ATTACHMENTS) break;
      const ok = file.size <= MAX_FILE_SIZE && (
        file.type.startsWith("image/") || file.type === "application/pdf"
      );
      if (ok) valid.push(file);
      else if (file.size > MAX_FILE_SIZE) {
        toast({ title: "Fichier trop volumineux", description: `${file.name} : max 10 Mo`, variant: "destructive" });
      }
    }
    setFiles((prev) => [...prev, ...valid].slice(0, MAX_ATTACHMENTS));
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

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

      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
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

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Erreur");

      const ticketId = data.ticket?.id;
      if (ticketId && files.length > 0) {
        for (const file of files) {
          const fd = new FormData();
          fd.append("file", file);
          await fetch(`/api/tickets/${ticketId}/attachments`, {
            method: "POST",
            body: fd,
          });
        }
      }

      try { localStorage.removeItem(DRAFT_STORAGE_KEY); } catch { /* ignore */ }
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
              className="group text-sm font-bold text-muted-foreground hover:text-indigo-600 flex items-center gap-2 transition-colors"
            >
              <div className="p-1.5 rounded-lg bg-muted group-hover:bg-indigo-50 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </div>
              Retour aux demandes
            </Link>
            <div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">Nouvelle Demande</h1>
              <p className="text-muted-foreground text-lg mt-1">Comment pouvons-nous vous aider aujourd'hui ?</p>
            </div>
          </div>

          {/* Switch Mode SOTA */}
          <div className="bg-muted p-1.5 rounded-2xl flex border border-border shadow-inner">
            <button 
              onClick={() => setMode('tom')}
              className={cn(
                "px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center gap-2",
                mode === 'tom' 
                  ? "bg-card shadow-lg text-indigo-600" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className={cn("h-4 w-4", mode === 'tom' ? "text-amber-500" : "text-muted-foreground")} />
              Assistant Tom
            </button>
            <button 
              onClick={() => setMode('classic')}
              className={cn(
                "px-6 py-2.5 text-sm font-bold rounded-xl transition-all",
                mode === 'classic' 
                  ? "bg-card shadow-lg text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
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
                  <GlassCard className="p-8 border-border bg-card shadow-2xl space-y-8">
                    <div className="flex items-center justify-between gap-4 border-b pb-6">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                          <Wrench className="h-6 w-6 text-indigo-600" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Formulaire de demande</h3>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive rounded-xl"
                        onClick={clearDraft}
                      >
                        Effacer le brouillon
                      </Button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8">
                      <div className="space-y-3">
                        <Label htmlFor="titre" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Objet de la demande</Label>
                        <Input 
                          id="titre" 
                          placeholder="Ex: Robinet qui fuit, Problème de serrure..." 
                          value={form.titre} 
                          onChange={(e) => setForm({ ...form, titre: e.target.value })} 
                          className="h-14 rounded-2xl border-border focus:ring-indigo-500 font-bold text-lg"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Catégorie</Label>
                          <Select value={form.categorie} onValueChange={(v) => setForm({ ...form, categorie: v })}>
                            <SelectTrigger className="h-14 rounded-2xl border-border font-bold">
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
                          <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Degré d'urgence</Label>
                          <div className="flex gap-2 p-1.5 bg-muted rounded-2xl border border-border">
                            {priorities.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => setForm({ ...form, priorite: p.value })}
                                className={cn(
                                  "flex-1 py-3 px-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all",
                                  form.priorite === p.value 
                                    ? "bg-card shadow-sm text-indigo-600 ring-1 ring-indigo-100" 
                                    : "text-muted-foreground hover:text-foreground/80"
                                )}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label htmlFor="description" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Détails de l'intervention</Label>
                        <Textarea 
                          id="description" 
                          placeholder="Veuillez décrire le problème, sa localisation et si possible les circonstances..." 
                          value={form.description} 
                          onChange={(e) => setForm({ ...form, description: e.target.value })} 
                          className="rounded-3xl border-border focus:ring-indigo-500 min-h-[200px] p-6 text-lg"
                        />
                      </div>

                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                          Pièces jointes (optionnel)
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Images ou PDF, max 10 Mo par fichier, {MAX_ATTACHMENTS} fichiers maximum.
                        </p>
                        <div className="flex flex-wrap gap-2 items-center">
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              accept={ACCEPTED_TYPES}
                              multiple
                              className="hidden"
                              onChange={handleFileChange}
                            />
                            <Button type="button" variant="outline" size="sm" className="gap-2 rounded-xl" asChild>
                              <span>
                                <ImagePlus className="h-4 w-4" />
                                Ajouter des fichiers
                              </span>
                            </Button>
                          </label>
                          {files.map((file, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="gap-1 pr-1 rounded-lg font-normal"
                            >
                              <span className="max-w-[120px] truncate">{file.name}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(index)}
                                className="p-0.5 rounded hover:bg-muted"
                                aria-label="Supprimer"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
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
              <GlassCard className="p-6 border-border bg-amber-50/50 space-y-4">
                <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <h4 className="font-bold text-foreground">En cas d'urgence vitale</h4>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Si votre sécurité est menacée (incendie, fuite de gaz majeure, effondrement), contactez immédiatement les pompiers (18) ou le SAMU (15) avant de créer un ticket.
                </p>
              </GlassCard>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <GlassCard className="p-6 border-border bg-card shadow-lg space-y-4">
                <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <h4 className="font-bold text-foreground">Prise en charge rapide</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ajouter une description précise permet à votre bailleur de mandater le bon prestataire dès le premier passage.
                </p>
                <div className="pt-2">
                  <Badge variant="outline" className="bg-muted border-border text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
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
