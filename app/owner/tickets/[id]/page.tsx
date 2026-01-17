"use client";
// @ts-nocheck

/**
 * Page de détail d'un ticket - SOTA 2025
 * Gestion complète des interventions avec prestataires
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Wrench,
  Building2,
  Calendar,
  Clock,
  User,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  PauseCircle,
  Loader2,
  Phone,
  Mail,
  FileText,
  Search,
  Euro,
  Star,
  UserPlus,
  ExternalLink,
  Sparkles,
  HardHat,
  CalendarClock,
  Receipt,
  CircleDot,
  TrendingUp,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useSubscription } from "@/components/subscription/subscription-provider";
import { format, formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ============================================
// CONFIGURATIONS
// ============================================

const statusConfig = {
  open: { label: "Ouvert", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300", icon: AlertCircle },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300", icon: Wrench },
  paused: { label: "En pause", color: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300", icon: PauseCircle },
  resolved: { label: "Résolu", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300", icon: CheckCircle2 },
  closed: { label: "Fermé", color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300", icon: CheckCircle2 },
};

const priorityConfig = {
  basse: { label: "Basse", color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  normale: { label: "Normale", color: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400" },
  haute: { label: "Haute", color: "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400" },
  urgente: { label: "Urgente", color: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400" },
};

const categoryConfig: Record<string, { icon: any; label: string }> = {
  plomberie: { icon: "🔧", label: "Plomberie" },
  electricite: { icon: "⚡", label: "Électricité" },
  chauffage: { icon: "🔥", label: "Chauffage" },
  serrurerie: { icon: "🔑", label: "Serrurerie" },
  menuiserie: { icon: "🪵", label: "Menuiserie" },
  peinture: { icon: "🎨", label: "Peinture" },
  nettoyage: { icon: "🧹", label: "Nettoyage" },
  jardinage: { icon: "🌱", label: "Jardinage" },
  autre: { icon: "📋", label: "Autre" },
};

// ============================================
// TYPES
// ============================================

interface Ticket {
  id: string;
  titre: string;
  description: string;
  statut: keyof typeof statusConfig;
  priorite: keyof typeof priorityConfig;
  categorie?: string;
  created_at: string;
  updated_at?: string;
  property_id?: string;
  property?: {
    id: string;
    adresse_complete: string;
    ville?: string;
  };
  created_by?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
    telephone?: string;
  };
  comments?: Comment[];
  work_order?: WorkOrder;
  quotes_count?: number;
  pending_quotes_count?: number;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    prenom: string;
    nom: string;
    role: string;
  };
}

interface WorkOrder {
  id: string;
  status: "assigned" | "scheduled" | "in_progress" | "done" | "cancelled";
  scheduled_date?: string;
  provider?: Provider;
  quote_amount?: number;
}

interface Provider {
  id: string;
  prenom: string;
  nom: string;
  email?: string;
  telephone?: string;
  avatar_url?: string;
  specialties?: string[];
  rating?: number;
  reviews_count?: number;
  completed_jobs?: number;
  response_time?: string;
}

interface Quote {
  id: string;
  amount: number;
  status: "pending" | "accepted" | "rejected";
  provider?: Provider;
}

// ============================================
// NEARBY PROVIDER (Google Places)
// ============================================

interface NearbyProvider {
  id: string;
  name: string;
  address: string;
  distance_km?: number;
  rating?: number;
  reviews_count?: number;
  phone?: string;
  is_open?: boolean;
  photo_url?: string;
  google_maps_url: string;
  source: "google";
}

// ============================================
// PROVIDER SEARCH MODAL - PREMIUM VERSION
// ============================================

function ProviderSearchModal({
  open,
  onOpenChange,
  ticketId,
  category,
  propertyId,
  propertyAddress,
  onProviderSelected,
  onQuoteRequested,
  userPlan = "starter",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  category?: string;
  propertyId?: string;
  propertyAddress?: string;
  onProviderSelected: (provider: Provider) => void;
  onQuoteRequested: () => void;
  userPlan?: string;
}) {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [nearbyProviders, setNearbyProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [activeTab, setActiveTab] = useState<"platform" | "nearby">("platform");

  // Plans premium qui ont accès à Google Places
  const isPremium = ["confort", "pro", "enterprise"].includes(userPlan);

  useEffect(() => {
    if (open) {
      fetchProviders();
      if (isPremium && propertyAddress) {
        fetchNearbyProviders();
      }
    }
  }, [open, category, isPremium, propertyAddress]);

  async function fetchProviders() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("services", category);
      params.set("limit", "50");
      
      const res = await fetch(`/api/providers/search?${params}`);
      if (res.ok) {
        const data = await res.json();
        const formattedProviders = (data.providers || []).map((p: any) => ({
          id: p.id,
          prenom: p.name?.split(' ')[0] || '',
          nom: p.name?.split(' ').slice(1).join(' ') || '',
          avatar_url: p.avatar_url,
          specialties: p.services || [],
          rating: p.rating || 0,
          reviews_count: p.review_count || 0,
          completed_jobs: p.intervention_count || 0,
          response_time: p.is_urgent_available ? "Dispo urgence" : undefined,
        }));
        setProviders(formattedProviders);
      }
    } catch (error) {
      console.error("Erreur recherche prestataires:", error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchNearbyProviders() {
    setLoadingNearby(true);
    try {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (propertyAddress) params.set("address", propertyAddress);
      params.set("radius", "15000"); // 15km
      
      const res = await fetch(`/api/providers/nearby?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNearbyProviders(data.providers || []);
      } else if (res.status === 403) {
        // Plan non premium - ignorer silencieusement
        setNearbyProviders([]);
      }
    } catch (error) {
      console.error("Erreur recherche prestataires locaux:", error);
      setNearbyProviders([]);
    } finally {
      setLoadingNearby(false);
    }
  }

  const toggleProvider = (providerId: string) => {
    setSelectedProviders(prev => 
      prev.includes(providerId) 
        ? prev.filter(id => id !== providerId)
        : [...prev, providerId]
    );
  };

  const handleRequestQuotes = async () => {
    if (selectedProviders.length === 0) {
      toast({ title: "Sélectionnez au moins un prestataire", variant: "destructive" });
      return;
    }

    setRequesting(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider_ids: selectedProviders }),
      });

      if (res.ok) {
        toast({ 
          title: "✅ Demandes envoyées", 
          description: `${selectedProviders.length} prestataire(s) ont été sollicités pour un devis.` 
        });
        onQuoteRequested();
        onOpenChange(false);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors de l'envoi");
      }
    } catch (error: unknown) {
      toast({ title: "Erreur", description: error instanceof Error ? error.message : "Une erreur est survenue", variant: "destructive" });
    } finally {
      setRequesting(false);
    }
  };

  const filteredProviders = providers.filter(p => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.prenom?.toLowerCase().includes(searchLower) ||
      p.nom?.toLowerCase().includes(searchLower) ||
      p.specialties?.some(s => s.toLowerCase().includes(searchLower))
    );
  });

  // Générer les URLs de recherche externe
  const categoryLabel = categoryConfig[category || "autre"]?.label || "artisan";
  const searchQuery = encodeURIComponent(`${categoryLabel} ${propertyAddress || ""}`);
  const googleMapsUrl = `https://www.google.com/maps/search/${searchQuery}`;
  const pagesJaunesUrl = `https://www.pagesjaunes.fr/recherche/${encodeURIComponent(categoryLabel)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50">
          <DialogTitle className="flex items-center gap-2">
            <HardHat className="h-5 w-5 text-blue-600" />
            Trouver un prestataire
          </DialogTitle>
          <DialogDescription>
            Sélectionnez des prestataires pour demander des devis
          </DialogDescription>
        </DialogHeader>

        {/* Onglets pour plans Premium */}
        {isPremium && (
          <div className="px-6 pt-4 flex gap-2">
            <Button
              variant={activeTab === "platform" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("platform")}
              className={activeTab === "platform" ? "bg-blue-600" : ""}
            >
              <HardHat className="h-4 w-4 mr-2" />
              Plateforme
            </Button>
            <Button
              variant={activeTab === "nearby" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("nearby")}
              className={activeTab === "nearby" ? "bg-emerald-600" : ""}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              À proximité
              <Badge variant="secondary" className="ml-2 text-xs bg-gradient-to-r from-amber-400 to-orange-500 text-white">
                Premium
              </Badge>
            </Button>
          </div>
        )}

        <div className="px-6 py-4 border-b bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par nom ou spécialité..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {category && (
              <Badge variant="secondary" className="gap-1">
                {categoryConfig[category]?.icon || "📋"} 
                {categoryConfig[category]?.label || category}
              </Badge>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-3">
            {/* ONGLET PLATEFORME */}
            {(activeTab === "platform" || !isPremium) && (
              <>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                  </div>
                ) : filteredProviders.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <HardHat className="h-8 w-8 text-slate-400" />
                    </div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Aucun prestataire disponible
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      {category 
                        ? `Aucun prestataire spécialisé en "${categoryConfig[category]?.label || category}" n'est encore inscrit.`
                        : "Aucun prestataire n'est encore inscrit sur la plateforme."
                      }
                    </p>
                    
                    {/* LIENS EXTERNES - Toujours visible quand pas de prestataires */}
                    <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-blue-950 border border-slate-200 dark:border-slate-700">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                        🔍 Rechercher un artisan en dehors de la plateforme :
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <a 
                          href={googleMapsUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full gap-2 hover:bg-blue-50 hover:border-blue-300">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                            </svg>
                            Google Maps
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                        <a 
                          href={pagesJaunesUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex-1"
                        >
                          <Button variant="outline" className="w-full gap-2 hover:bg-amber-50 hover:border-amber-300">
                            <span className="text-lg">📒</span>
                            PagesJaunes
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                      </div>
                    </div>

                    {/* UPSELL pour plans Starter */}
                    {!isPremium && (
                      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-full bg-white/20">
                            <Sparkles className="h-5 w-5" />
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-semibold text-sm">Passez au plan Confort</p>
                            <p className="text-xs text-white/80 mt-1">
                              Accédez à la recherche de prestataires locaux avec notes, avis et coordonnées directes.
                            </p>
                            <Link href="/owner/settings/subscription">
                              <Button 
                                size="sm" 
                                className="mt-3 bg-white text-indigo-600 hover:bg-white/90"
                              >
                                Voir les offres →
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-muted-foreground">Ou :</p>
                      <div className="flex flex-col gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSearch("");
                            fetchProviders();
                          }}
                        >
                          Voir tous les prestataires
                        </Button>
                        <Link href="/owner/providers/invite">
                          <Button variant="link" size="sm" className="text-blue-600">
                            Inviter un prestataire →
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  filteredProviders.map((provider) => {
                    const isSelected = selectedProviders.includes(provider.id);
                    return (
                      <motion.div
                        key={provider.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "p-4 rounded-xl border-2 cursor-pointer transition-all",
                          isSelected 
                            ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30" 
                            : "border-slate-200 hover:border-blue-300 dark:border-slate-700"
                        )}
                        onClick={() => toggleProvider(provider.id)}
                      >
                        <div className="flex items-start gap-4">
                          <div className="relative">
                            <Avatar className="h-14 w-14">
                              <AvatarImage src={provider.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-lg">
                                {provider.prenom?.[0]}{provider.nom?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            {isSelected && (
                              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-blue-500 flex items-center justify-center">
                                <CheckCircle2 className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                            {provider.prenom} {provider.nom}
                          </h4>
                          {provider.rating && provider.rating >= 4.5 && (
                            <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white text-xs gap-1">
                              <Star className="h-3 w-3 fill-white" />
                              Top
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          {provider.rating && (
                            <span className="flex items-center gap-1">
                              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                              {provider.rating.toFixed(1)}
                              {provider.reviews_count && (
                                <span className="text-xs">({provider.reviews_count})</span>
                              )}
                            </span>
                          )}
                          {provider.completed_jobs && (
                            <>
                              <span>•</span>
                              <span>{provider.completed_jobs} interventions</span>
                            </>
                          )}
                          {provider.response_time && (
                            <>
                              <span>•</span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                ⚡ {provider.response_time}
                              </span>
                            </>
                          )}
                        </div>

                        {provider.specialties && provider.specialties.length > 0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {provider.specialties.slice(0, 4).map((s) => (
                              <Badge key={s} variant="outline" className="text-xs">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
              </>
            )}

            {/* ONGLET À PROXIMITÉ - Plans Premium uniquement */}
            {activeTab === "nearby" && isPremium && (
              <>
                {loadingNearby ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  </div>
                ) : nearbyProviders.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                      <ExternalLink className="h-8 w-8 text-emerald-500" />
                    </div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Aucun prestataire trouvé à proximité
                    </h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Essayez d'élargir la recherche ou utilisez les liens externes.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" className="gap-2">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                          </svg>
                          Google Maps
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </a>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        <span>
                          <strong>{nearbyProviders.length}</strong> prestataires trouvés à proximité via Google Places
                        </span>
                      </p>
                    </div>
                    
                    {nearbyProviders.map((provider) => (
                      <motion.div
                        key={provider.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900 dark:to-teal-900 flex items-center justify-center overflow-hidden">
                            {provider.photo_url ? (
                              <img src={provider.photo_url} alt={provider.name} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="h-6 w-6 text-emerald-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                                {provider.name}
                              </h4>
                              {provider.is_open && (
                                <Badge className="bg-emerald-500 text-white text-xs">
                                  Ouvert
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                              {provider.address}
                            </p>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                              {provider.rating && (
                                <span className="flex items-center gap-1">
                                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                                  {provider.rating.toFixed(1)}
                                  {provider.reviews_count && (
                                    <span className="text-xs">({provider.reviews_count})</span>
                                  )}
                                </span>
                              )}
                              {provider.distance_km && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-600">📍 {provider.distance_km} km</span>
                                </>
                              )}
                            </div>

                            <div className="flex gap-2 mt-3">
                              {provider.phone && (
                                <a href={`tel:${provider.phone}`}>
                                  <Button size="sm" variant="outline" className="gap-1 text-xs">
                                    <Phone className="h-3 w-3" />
                                    Appeler
                                  </Button>
                                </a>
                              )}
                              <a href={provider.google_maps_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" variant="outline" className="gap-1 text-xs">
                                  <ExternalLink className="h-3 w-3" />
                                  Voir sur Maps
                                </Button>
                              </a>
                              <Link href="/owner/providers/invite">
                                <Button size="sm" className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-700">
                                  <UserPlus className="h-3 w-3" />
                                  Inviter
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              {activeTab === "platform" ? (
                `${selectedProviders.length} prestataire(s) sélectionné(s)`
              ) : (
                "Contactez directement les prestataires"
              )}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {activeTab === "nearby" ? "Fermer" : "Annuler"}
              </Button>
              {activeTab === "platform" && (
                <Button 
                  onClick={handleRequestQuotes}
                  disabled={selectedProviders.length === 0 || requesting}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {requesting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Demander des devis
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// INTERVENTION CARD
// ============================================

function InterventionCard({
  ticket,
  workOrder,
  quotesCount,
  pendingQuotesCount,
  onOpenProviderSearch,
}: {
  ticket: Ticket;
  workOrder?: WorkOrder;
  quotesCount: number;
  pendingQuotesCount: number;
  onOpenProviderSearch: () => void;
}) {
  const hasProvider = workOrder?.provider;
  const isResolved = ticket.statut === "resolved" || ticket.statut === "closed";

  return (
    <Card className="bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 border-blue-200/50 dark:border-blue-800/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900">
            <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          Intervention
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Prestataire assigné */}
        {hasProvider ? (
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={workOrder?.provider?.avatar_url} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700">
                  {workOrder?.provider?.prenom?.[0]}{workOrder?.provider?.nom?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-emerald-900 dark:text-emerald-100">
                  {workOrder?.provider?.prenom} {workOrder?.provider?.nom}
                </p>
                <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                  <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900 border-emerald-300 text-xs">
                    {workOrder?.status === "assigned" && "Assigné"}
                    {workOrder?.status === "scheduled" && "Planifié"}
                    {workOrder?.status === "in_progress" && "En cours"}
                    {workOrder?.status === "done" && "Terminé"}
                  </Badge>
                  {workOrder?.scheduled_date && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {format(new Date(workOrder.scheduled_date), "dd MMM", { locale: fr })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {workOrder?.quote_amount && (
              <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                <span className="text-xs text-emerald-700 dark:text-emerald-400">Montant accepté</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-100">
                  {workOrder.quote_amount.toFixed(2)}€
                </span>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Actions si pas de prestataire */}
            {!isResolved && (
              <div className="space-y-2">
                <Button 
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onClick={onOpenProviderSearch}
                >
                  <Search className="mr-2 h-4 w-4" />
                  Trouver un prestataire
                </Button>
              </div>
            )}
          </>
        )}

        {/* Devis en attente */}
        {quotesCount > 0 && (
          <Link href={`/owner/tickets/${ticket.id}/quotes`}>
            <Button 
              variant="outline" 
              className={cn(
                "w-full justify-between",
                pendingQuotesCount > 0 && "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30"
              )}
            >
              <span className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Voir les devis
              </span>
              <Badge 
                variant={pendingQuotesCount > 0 ? "default" : "secondary"}
                className={pendingQuotesCount > 0 ? "bg-amber-500" : ""}
              >
                {pendingQuotesCount > 0 ? `${pendingQuotesCount} en attente` : quotesCount}
              </Badge>
            </Button>
          </Link>
        )}

        {/* Message si résolu sans prestataire */}
        {isResolved && !hasProvider && quotesCount === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Résolu sans intervention externe
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const ticketId = params.id as string;

  // Subscription hook pour accès premium
  const { currentPlan } = useSubscription();

  // States
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [providerSearchOpen, setProviderSearchOpen] = useState(false);
  const [quotesCount, setQuotesCount] = useState(0);
  const [pendingQuotesCount, setPendingQuotesCount] = useState(0);

  // Fetch ticket data
  const fetchTicket = useCallback(async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`);
      if (response.ok) {
        const data = await response.json();
        setTicket(data.ticket || data);
      }
    } catch (error) {
      console.error("Erreur chargement ticket:", error);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  // Fetch quotes count
  const fetchQuotesCount = useCallback(async () => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/quotes`);
      if (response.ok) {
        const data = await response.json();
        const quotes = data.quotes || [];
        setQuotesCount(quotes.length);
        setPendingQuotesCount(quotes.filter((q: Quote) => q.status === "pending").length);
      }
    } catch (error) {
      console.error("Erreur chargement devis:", error);
    }
  }, [ticketId]);

  useEffect(() => {
    if (ticketId) {
      fetchTicket();
      fetchQuotesCount();
    }
  }, [ticketId, fetchTicket, fetchQuotesCount]);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: newStatus }),
      });

      if (response.ok) {
        setTicket((prev) => prev ? { ...prev, statut: newStatus as any } : null);
        toast({ title: "✅ Statut mis à jour" });
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut", variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setSendingComment(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        const data = await response.json();
        setTicket((prev) => prev ? {
          ...prev,
          comments: [...(prev.comments || []), data.comment || data],
        } : null);
        setNewComment("");
        toast({ title: "💬 Commentaire ajouté" });
      }
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'ajouter le commentaire", variant: "destructive" });
    } finally {
      setSendingComment(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-muted-foreground">Chargement du ticket...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (!ticket) {
    return (
      <div className="p-6">
        <Card className="bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
          <CardContent className="py-16 text-center">
            <Wrench className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ticket introuvable</h3>
            <p className="text-muted-foreground mb-6">
              Ce ticket n'existe pas ou vous n'y avez pas accès.
            </p>
            <Button asChild>
              <Link href="/owner/tickets">Retour aux tickets</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[ticket.statut] || statusConfig.open;
  const StatusIcon = status.icon;
  const priority = priorityConfig[ticket.priorite] || priorityConfig.normale;
  const categoryInfo = categoryConfig[ticket.categorie || "autre"];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-950 dark:via-blue-950/10 dark:to-slate-950 min-h-screen"
      >
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <div className="mb-6">
            <Link
              href="/owner/tickets"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Retour aux tickets
            </Link>

            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Badge className={cn(status.color, "flex items-center gap-1")}>
                    <StatusIcon className="h-3 w-3" />
                    {status.label}
                  </Badge>
                  <Badge className={priority.color}>{priority.label}</Badge>
                  {ticket.categorie && (
                    <Badge variant="outline" className="gap-1">
                      <span>{categoryInfo?.icon}</span>
                      {categoryInfo?.label || ticket.categorie}
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {ticket.titre}
                </h1>
                <p className="text-muted-foreground text-sm mt-2">
                  Créé {formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: fr })}
                  {" • "}
                  {format(new Date(ticket.created_at), "dd MMMM yyyy à HH:mm", { locale: fr })}
                </p>
              </div>

              <div className="flex gap-2">
                <Select
                  value={ticket.statut}
                  onValueChange={handleStatusChange}
                  disabled={updating}
                >
                  <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900">
                    <SelectValue placeholder="Changer le statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <span className="flex items-center gap-2">
                        <CircleDot className="h-3 w-3 text-blue-500" />
                        Ouvert
                      </span>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <span className="flex items-center gap-2">
                        <Wrench className="h-3 w-3 text-amber-500" />
                        En cours
                      </span>
                    </SelectItem>
                    <SelectItem value="paused">
                      <span className="flex items-center gap-2">
                        <PauseCircle className="h-3 w-3 text-slate-500" />
                        En pause
                      </span>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        Résolu
                      </span>
                    </SelectItem>
                    <SelectItem value="closed">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-slate-500" />
                        Fermé
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Description */}
              <Card className="bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {ticket.description}
                  </p>
                </CardContent>
              </Card>

              {/* Comments / Échanges */}
              <Card className="bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                    Échanges ({ticket.comments?.length || 0})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {ticket.comments && ticket.comments.length > 0 ? (
                    <div className="space-y-4">
                      {ticket.comments.map((comment) => (
                        <motion.div 
                          key={comment.id} 
                          className="flex gap-3"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                        >
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 text-xs">
                              {comment.author.prenom?.[0]}{comment.author.nom?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm">
                                {comment.author.prenom} {comment.author.nom}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {comment.author.role === "owner" ? "Propriétaire" : 
                                 comment.author.role === "tenant" ? "Locataire" : "Prestataire"}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: fr })}
                              </span>
                            </div>
                            <p className="text-sm bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-slate-700 dark:text-slate-300">
                              {comment.content}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">Aucun échange pour le moment</p>
                    </div>
                  )}

                  <Separator />

                  {/* New comment */}
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Ajouter un commentaire..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      className="bg-white dark:bg-slate-800 resize-none"
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={sendingComment || !newComment.trim()}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {sendingComment ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Envoyer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* INTERVENTION CARD - NEW */}
              <InterventionCard
                ticket={ticket}
                workOrder={ticket.work_order}
                quotesCount={quotesCount}
                pendingQuotesCount={pendingQuotesCount}
                onOpenProviderSearch={() => setProviderSearchOpen(true)}
              />

              {/* Property info */}
              {ticket.property && (
                <Card className="bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-blue-500" />
                      Bien concerné
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Link
                      href={`/owner/properties/${ticket.property.id}`}
                      className="text-sm hover:text-blue-600 hover:underline flex items-center gap-1"
                    >
                      {ticket.property.adresse_complete}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </CardContent>
                </Card>
              )}

              {/* Created by */}
              {ticket.created_by && (
                <Card className="bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-500" />
                      Signalé par
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium">
                      {ticket.created_by.prenom} {ticket.created_by.nom}
                    </p>
                    {ticket.created_by.email && (
                      <a 
                        href={`mailto:${ticket.created_by.email}`} 
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-blue-600"
                      >
                        <Mail className="h-4 w-4" />
                        {ticket.created_by.email}
                      </a>
                    )}
                    {ticket.created_by.telephone && (
                      <a 
                        href={`tel:${ticket.created_by.telephone}`} 
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-blue-600"
                      >
                        <Phone className="h-4 w-4" />
                        {ticket.created_by.telephone}
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card className="bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Historique
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="relative">
                    <div className="absolute left-[9px] top-3 bottom-3 w-0.5 bg-slate-200 dark:bg-slate-700" />
                    
                    <div className="space-y-4 text-sm">
                      {/* Création */}
                      <div className="flex items-start gap-3 relative">
                        <div className="h-5 w-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 shadow-sm z-10 mt-0.5 flex items-center justify-center">
                          <Sparkles className="h-3 w-3 text-white" />
                        </div>
                        <div className="flex-1 pb-1">
                          <p className="font-medium text-slate-900 dark:text-slate-100">Ticket créé</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(ticket.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                      
                      {/* Commentaires */}
                      {ticket.comments?.slice(0, 3).map((comment, index) => (
                        <div key={comment.id || index} className="flex items-start gap-3 relative">
                          <div className="h-5 w-5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900 shadow-sm z-10 mt-0.5 flex items-center justify-center">
                            <MessageSquare className="h-3 w-3 text-white" />
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {comment.author?.prenom || "Quelqu'un"} a commenté
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(comment.created_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                            </p>
                          </div>
                        </div>
                      ))}
                      
                      {/* Devis reçus */}
                      {quotesCount > 0 && (
                        <div className="flex items-start gap-3 relative">
                          <div className="h-5 w-5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-900 shadow-sm z-10 mt-0.5 flex items-center justify-center">
                            <Receipt className="h-3 w-3 text-white" />
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {quotesCount} devis reçu{quotesCount > 1 ? "s" : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {pendingQuotesCount} en attente de décision
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Work order */}
                      {ticket.work_order && (
                        <div className="flex items-start gap-3 relative">
                          <div className="h-5 w-5 rounded-full bg-violet-500 border-2 border-white dark:border-slate-900 shadow-sm z-10 mt-0.5 flex items-center justify-center">
                            <HardHat className="h-3 w-3 text-white" />
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              Prestataire assigné
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ticket.work_order.provider?.prenom} {ticket.work_order.provider?.nom}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Statut actuel si pas "open" */}
                      {ticket.statut !== "open" && (
                        <div className="flex items-start gap-3 relative">
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 border-white dark:border-slate-900 shadow-sm z-10 mt-0.5 flex items-center justify-center",
                            ticket.statut === "resolved" || ticket.statut === "closed" 
                              ? "bg-green-500" 
                              : ticket.statut === "in_progress" 
                                ? "bg-amber-500" 
                                : "bg-slate-400"
                          )}>
                            <StatusIcon className="h-3 w-3 text-white" />
                          </div>
                          <div className="flex-1 pb-1">
                            <p className="font-medium text-slate-900 dark:text-slate-100">
                              {status.label}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {ticket.updated_at 
                                ? format(new Date(ticket.updated_at), "dd MMM yyyy 'à' HH:mm", { locale: fr })
                                : "Récemment"}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Provider Search Modal */}
      <ProviderSearchModal
        open={providerSearchOpen}
        onOpenChange={setProviderSearchOpen}
        ticketId={ticketId}
        category={ticket.categorie}
        propertyId={ticket.property_id}
        propertyAddress={ticket.property?.adresse_complete}
        userPlan={currentPlan}
        onProviderSelected={(provider) => {
          // Direct assignment logic could go here
          toast({ title: "Prestataire sélectionné", description: `${provider.prenom} ${provider.nom}` });
        }}
        onQuoteRequested={() => {
          fetchQuotesCount();
        }}
      />
    </>
  );
}
