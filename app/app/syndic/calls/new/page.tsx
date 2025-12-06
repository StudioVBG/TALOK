"use client";
// @ts-nocheck

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ArrowLeft,
  Building2,
  Euro,
  CalendarIcon,
  Send,
  Loader2,
  Users,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format, addMonths } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

const callTypes = [
  { value: "quarterly", label: "Appel trimestriel", description: "Charges courantes" },
  { value: "annual", label: "Appel annuel", description: "Budget annuel" },
  { value: "exceptional", label: "Appel exceptionnel", description: "Travaux votés en AG" },
  { value: "regularization", label: "Régularisation", description: "Ajustement des charges" },
];

interface Site {
  id: string;
  name: string;
  total_units: number;
  total_owners: number;
}

export default function NewCallPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const preselectedSiteId = searchParams.get("siteId");

  const [loading, setLoading] = useState(false);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [selectedSite, setSelectedSite] = useState<Site | null>(null);

  const [form, setForm] = useState({
    site_id: preselectedSiteId || "",
    type: "quarterly",
    title: "",
    description: "",
    total_amount: "",
    due_date: addMonths(new Date(), 1),
    period_start: new Date(),
    period_end: addMonths(new Date(), 3),
  });

  useEffect(() => {
    async function fetchSites() {
      try {
        const response = await fetch("/api/copro/sites");
        if (response.ok) {
          const data = await response.json();
          const sitesData = data.sites || data || [];
          setSites(sitesData);
          
          if (preselectedSiteId) {
            const site = sitesData.find((s: Site) => s.id === preselectedSiteId);
            setSelectedSite(site || null);
          }
        }
      } catch (error) {
        console.error("Erreur chargement sites:", error);
      } finally {
        setLoadingSites(false);
      }
    }
    fetchSites();
  }, [preselectedSiteId]);

  const handleSiteChange = (siteId: string) => {
    setForm({ ...form, site_id: siteId });
    const site = sites.find((s) => s.id === siteId);
    setSelectedSite(site || null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.site_id || !form.title || !form.total_amount) {
      toast({
        title: "Champs requis",
        description: "Veuillez remplir tous les champs obligatoires.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/copro/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          total_amount: parseFloat(form.total_amount),
        }),
      });

      if (!response.ok) throw new Error("Erreur création");

      toast({
        title: "Appel de fonds créé",
        description: "L'appel de fonds a été créé et sera envoyé aux copropriétaires.",
      });

      router.push(`/app/syndic/sites/${form.site_id}`);
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'appel de fonds.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const amountPerOwner = selectedSite && form.total_amount
    ? (parseFloat(form.total_amount) / (selectedSite.total_owners || 1)).toFixed(2)
    : "0.00";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6"
    >
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/app/syndic/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour au tableau de bord
          </Link>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 bg-clip-text text-transparent">
            Nouvel appel de fonds
          </h1>
          <p className="text-muted-foreground mt-1">
            Créez un appel de fonds pour une copropriété
          </p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Euro className="h-5 w-5 text-indigo-500" />
              Détails de l'appel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Site */}
              <div className="space-y-2">
                <Label htmlFor="site_id" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  Site concerné *
                </Label>
                <Select
                  value={form.site_id}
                  onValueChange={handleSiteChange}
                  disabled={loadingSites}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder={loadingSites ? "Chargement..." : "Sélectionner un site"} />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((site) => (
                      <SelectItem key={site.id} value={site.id}>
                        {site.name} ({site.total_owners || 0} copropriétaires)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type d'appel */}
              <div className="space-y-2">
                <Label>Type d'appel *</Label>
                <div className="grid grid-cols-2 gap-3">
                  {callTypes.map((type) => (
                    <div
                      key={type.value}
                      onClick={() => setForm({ ...form, type: type.value })}
                      className={cn(
                        "p-3 rounded-lg border-2 cursor-pointer transition-all",
                        form.type === type.value
                          ? "border-indigo-500 bg-indigo-50"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <p className="font-medium text-sm">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Titre */}
              <div className="space-y-2">
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex: Appel de charges Q1 2025"
                  className="bg-white"
                  required
                />
              </div>

              {/* Montant et Date d'échéance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="total_amount">Montant total (€) *</Label>
                  <div className="relative">
                    <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="total_amount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.total_amount}
                      onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                      placeholder="0.00"
                      className="pl-10 bg-white"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Date d'échéance *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal bg-white",
                          !form.due_date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {form.due_date ? format(form.due_date, "PPP", { locale: fr }) : "Sélectionner"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={form.due_date}
                        onSelect={(date) => date && setForm({ ...form, due_date: date })}
                        locale={fr}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Estimation par copropriétaire */}
              {selectedSite && form.total_amount && (
                <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-indigo-900">Estimation par copropriétaire</p>
                      <p className="text-sm text-indigo-700">
                        Environ <strong>{amountPerOwner} €</strong> par copropriétaire
                        <span className="text-indigo-500"> (répartition égale)</span>
                      </p>
                      <p className="text-xs text-indigo-500 mt-1">
                        * La répartition réelle sera calculée selon les tantièmes
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Détails de l'appel de fonds..."
                  rows={3}
                  className="bg-white resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1">
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Créer l'appel
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

