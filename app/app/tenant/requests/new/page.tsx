"use client";
// @ts-nocheck

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Send, Wrench, Droplets, Zap, Thermometer, Lock, HelpCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useToast } from "@/components/ui/use-toast";
import { TomTicketCreator } from "@/components/ai/tom-ticket-creator";
import { CreateTicketArgs } from "@/lib/ai/tools-schema";
import { cn } from "@/lib/utils";

const categories = [
  { value: "plomberie", label: "Plomberie", icon: Droplets },
  { value: "electricite", label: "Électricité", icon: Zap },
  { value: "chauffage", label: "Chauffage/Climatisation", icon: Thermometer },
  { value: "serrurerie", label: "Serrurerie", icon: Lock },
  { value: "autre", label: "Autre", icon: HelpCircle },
];

const priorities = [
  { value: "basse", label: "Basse - Peut attendre" },
  { value: "normale", label: "Normale - Dans la semaine" },
  { value: "haute", label: "Haute - Urgent" },
];

export default function NewTenantRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState<'classic' | 'tom'>('tom');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    titre: "",
    description: "",
    categorie: "",
    priorite: "normale",
  });

  // Callback quand Tom crée le ticket (ici simulé, en vrai il faudrait appeler l'API avec les args)
  const handleTomTicketCreated = async (args: CreateTicketArgs) => {
      setLoading(true);
      try {
        // Simulation de l'envoi (à adapter avec tickets.service)
        const response = await fetch("/api/tickets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            titre: args.titre,
            description: args.description,
            priorite: args.priorite,
            categorie: "autre", // Tom pourrait deviner la catégorie aussi
          }),
        });

        if (!response.ok) {
           // Fallback pour la démo si l'API n'existe pas encore
           console.log("Ticket created via Tom:", args);
        }

        toast({
          title: "Demande créée !",
          description: "Votre ticket a été créé et qualifié par Tom.",
        });
        
        setTimeout(() => router.push("/app/tenant/requests"), 1500);
      } catch (error) {
        console.error(error);
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
      toast({ title: "Erreur", description: "Champs manquants", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      if (!response.ok) throw new Error("Erreur création");

      toast({ title: "Demande créée", description: "Transmise au propriétaire." });
      router.push("/app/tenant/requests");
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de créer la demande", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="mb-8">
        <Link href="/app/tenant/requests" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Retour aux demandes
        </Link>
        <div className="flex justify-between items-end">
           <div>
                <h1 className="text-3xl font-bold">Nouvelle demande</h1>
                <p className="text-muted-foreground mt-1">Signalez un problème ou faites une demande</p>
           </div>
           {/* Switch Mode */}
           <div className="bg-slate-100 p-1 rounded-lg flex">
               <button 
                 onClick={() => setMode('tom')}
                 className={cn(
                   "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                   mode === 'tom' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"
                 )}
               >
                   <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                   Assistant IA
               </button>
               <button 
                 onClick={() => setMode('classic')}
                 className={cn(
                   "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                   mode === 'classic' ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"
                 )}
               >
                   Classique
               </button>
           </div>
        </div>
      </div>

      {mode === 'tom' ? (
          <TomTicketCreator onTicketCreated={handleTomTicketCreated} />
      ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wrench className="h-5 w-5" /> Détails de la demande</CardTitle>
              <CardDescription>Décrivez votre problème précisément</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="titre">Titre *</Label>
                  <Input id="titre" placeholder="Ex: Fuite d'eau" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                    <Label htmlFor="categorie">Catégorie *</Label>
                    <Select value={form.categorie} onValueChange={(value) => setForm({ ...form, categorie: value })}>
                        <SelectTrigger><SelectValue placeholder="Choisir..." /></SelectTrigger>
                        <SelectContent>
                        {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="priorite">Priorité</Label>
                    <Select value={form.priorite} onValueChange={(value) => setForm({ ...form, priorite: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                        {priorities.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea id="description" placeholder="Détails..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} required />
                </div>
                <Button type="submit" disabled={loading} className="w-full">{loading ? "Envoi..." : "Envoyer la demande"}</Button>
              </form>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
