"use client";

// =====================================================
// Recherche de prestataires par géolocalisation
// Carte (Leaflet/OSM) + listing autour d'un bien sélectionné
// Affichée en fallback quand aucun prestataire référencé
// =====================================================

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Phone,
  Star,
  ExternalLink,
  Loader2,
  Search,
  AlertCircle,
  Clock,
  Copy,
  Ticket,
  Bookmark,
  BookmarkCheck,
  Info,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/components/ui/use-toast";
import { geocodeAddress } from "@/lib/services/geocoding.service";
import { SERVICE_TYPE_LABELS } from "@/lib/data/service-pricing-reference";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false }
);
const Circle = dynamic(
  () => import("react-leaflet").then((m) => m.Circle),
  { ssr: false }
);

interface PropertyOption {
  id: string;
  label: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface NearbyProvider {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_km?: number;
  rating?: number;
  reviews_count?: number;
  phone?: string;
  is_open?: boolean;
  photo_url?: string;
  google_maps_url: string;
  source: "google" | "demo";
}

// Mapping ServiceType (filtres marketplace) -> catégorie API /api/providers/nearby
const SERVICE_TYPE_TO_CATEGORY: Record<string, string> = {
  plomberie: "plomberie",
  electricite: "electricite",
  chauffage_clim: "chauffage",
  serrurerie: "serrurerie",
  menuiserie: "menuiserie",
  peinture: "peinture",
  nettoyage: "nettoyage",
  jardinage: "jardinage",
};

function normalizeCategory(input?: string): string {
  if (!input) return "autre";
  return SERVICE_TYPE_TO_CATEGORY[input] || "autre";
}

// Sous-ensemble des catégories supportées par /api/providers/nearby
// (mapping côté API : CATEGORY_TO_GOOGLE_TYPE)
const NEARBY_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: "plomberie", label: SERVICE_TYPE_LABELS.plomberie },
  { value: "electricite", label: SERVICE_TYPE_LABELS.electricite },
  { value: "chauffage", label: SERVICE_TYPE_LABELS.chauffage_clim },
  { value: "serrurerie", label: SERVICE_TYPE_LABELS.serrurerie },
  { value: "menuiserie", label: SERVICE_TYPE_LABELS.menuiserie },
  { value: "peinture", label: SERVICE_TYPE_LABELS.peinture },
  { value: "nettoyage", label: SERVICE_TYPE_LABELS.nettoyage },
  { value: "jardinage", label: SERVICE_TYPE_LABELS.jardinage },
  { value: "autre", label: "Tout métier" },
];

const RADIUS_OPTIONS = [
  { value: 5000, label: "5 km" },
  { value: 10000, label: "10 km" },
  { value: 20000, label: "20 km" },
  { value: 50000, label: "50 km" },
];

interface NearbyProvidersSearchProps {
  initialCategory?: string;
  className?: string;
}

const SAVED_PROVIDERS_STORAGE_KEY = "talok:nearby-providers:saved";

function readSavedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(SAVED_PROVIDERS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeSavedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SAVED_PROVIDERS_STORAGE_KEY,
      JSON.stringify(Array.from(ids)),
    );
  } catch {
    /* quota exceeded — silencieux */
  }
}

export function NearbyProvidersSearch({
  initialCategory = "autre",
  className,
}: NearbyProvidersSearchProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [category, setCategory] = useState<string>(normalizeCategory(initialCategory));
  const [radius, setRadius] = useState<number>(10000);

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [detailProvider, setDetailProvider] = useState<NearbyProvider | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [propertyIcon, setPropertyIcon] = useState<any>(null);
  const [providerIcon, setProviderIcon] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setSavedIds(readSavedIds());
  }, []);

  const openDetail = (provider: NearbyProvider) => {
    setHighlightedId(provider.id);
    setDetailProvider(provider);
  };

  const toggleSaved = (provider: NearbyProvider) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(provider.id)) {
        next.delete(provider.id);
        toast({
          title: "Prestataire retiré",
          description: `${provider.name} ne fait plus partie de vos favoris locaux.`,
        });
      } else {
        next.add(provider.id);
        toast({
          title: "Prestataire enregistré",
          description: `${provider.name} a été ajouté à vos favoris (stockés sur cet appareil).`,
        });
      }
      writeSavedIds(next);
      return next;
    });
  };

  const copyContact = async (provider: NearbyProvider) => {
    const text = [
      provider.name,
      provider.address,
      provider.phone,
      provider.google_maps_url,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Coordonnées copiées",
        description: "Les informations du prestataire sont dans votre presse-papier.",
      });
    } catch {
      toast({
        title: "Copie impossible",
        description: "Votre navigateur a refusé l'accès au presse-papier.",
        variant: "destructive",
      });
    }
  };

  const createTicket = (provider: NearbyProvider) => {
    if (!selectedPropertyId) {
      toast({
        title: "Bien manquant",
        description: "Sélectionnez un bien avant de créer un ticket.",
        variant: "destructive",
      });
      return;
    }
    const params = new URLSearchParams({ propertyId: selectedPropertyId });
    const contactLines = [
      `Prestataire pressenti : ${provider.name}`,
      provider.address ? `Adresse : ${provider.address}` : null,
      provider.phone ? `Téléphone : ${provider.phone}` : null,
      provider.google_maps_url ? `Maps : ${provider.google_maps_url}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    if (contactLines) params.set("note", contactLines);
    router.push(`/owner/tickets/new?${params.toString()}`);
  };

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) ?? null,
    [properties, selectedPropertyId]
  );

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Charger les biens du propriétaire
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPropertiesLoading(true);
      try {
        const res = await fetch("/api/properties");
        if (!res.ok) throw new Error("HTTP " + res.status);
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : data.properties || data.data || [];
        const mapped: PropertyOption[] = list
          .map((p) => ({
            id: p.id,
            label:
              p.titre ||
              p.title ||
              [p.adresse_complete, p.ville].filter(Boolean).join(" — ") ||
              "Bien sans titre",
            address: [p.adresse_complete, p.code_postal, p.ville]
              .filter(Boolean)
              .join(", "),
            latitude: p.latitude ?? null,
            longitude: p.longitude ?? null,
          }))
          .filter((p) => !!p.address);
        if (cancelled) return;
        setProperties(mapped);
        if (mapped.length > 0) setSelectedPropertyId(mapped[0].id);
      } catch (err) {
        console.error("[NearbyProvidersSearch] Erreur chargement biens:", err);
      } finally {
        if (!cancelled) setPropertiesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Préparer les icônes Leaflet (uniquement côté client)
  useEffect(() => {
    if (typeof window === "undefined") return;
    import("leaflet").then((L) => {
      setPropertyIcon(
        L.divIcon({
          className: "talok-marker-property",
          html: `<div style="
            width: 38px; height: 38px;
            background: #2563EB;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
          "><div style="transform: rotate(45deg); color: white; font-size: 16px;">🏠</div></div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 38],
          popupAnchor: [0, -38],
        })
      );
      setProviderIcon(
        L.divIcon({
          className: "talok-marker-provider",
          html: `<div style="
            width: 32px; height: 32px;
            background: #f97316;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
          "><div style="transform: rotate(45deg); color: white; font-size: 14px;">🔧</div></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -32],
        })
      );
    });
  }, []);

  // Géocoder l'adresse du bien sélectionné si pas déjà fait
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!selectedProperty) {
        setCenter(null);
        return;
      }
      if (
        selectedProperty.latitude != null &&
        selectedProperty.longitude != null
      ) {
        setCenter({
          lat: selectedProperty.latitude,
          lng: selectedProperty.longitude,
        });
        return;
      }
      const result = await geocodeAddress(selectedProperty.address);
      if (cancelled) return;
      if (result) {
        setCenter({ lat: result.latitude, lng: result.longitude });
      } else {
        setCenter(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedProperty]);

  // Lancer la recherche dès qu'on a un centre, une catégorie et un rayon
  useEffect(() => {
    if (!center || !selectedProperty) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      setPremiumRequired(false);
      try {
        const params = new URLSearchParams({
          category,
          lat: String(center.lat),
          lng: String(center.lng),
          radius: String(radius),
          address: selectedProperty.address,
        });
        const res = await fetch(`/api/providers/nearby?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 403 && data?.error === "premium_required") {
          setPremiumRequired(true);
          setProviders([]);
        } else if (!res.ok) {
          setError(data?.error || "Erreur lors de la recherche");
          setProviders([]);
        } else {
          setProviders(data.providers || []);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[NearbyProvidersSearch] Erreur:", err);
          setError("Impossible de contacter le service de recherche");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [center, category, radius, selectedProperty]);

  if (propertiesLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center space-y-3">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-medium">Aucun bien à géolocaliser</h3>
          <p className="text-sm text-muted-foreground">
            Ajoutez un bien avec son adresse pour voir les prestataires autour.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Prestataires autour de votre logement
          </h3>
          <p className="text-sm text-muted-foreground">
            Aucun prestataire référencé pour le moment — voici les artisans à proximité du bien sélectionné.
          </p>
        </div>

        {/* Filtres */}
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Bien
            </label>
            <Select
              value={selectedPropertyId}
              onValueChange={setSelectedPropertyId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un bien" />
              </SelectTrigger>
              <SelectContent>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Métier
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NEARBY_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Rayon de recherche
            </label>
            <Select
              value={String(radius)}
              onValueChange={(v) => setRadius(Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RADIUS_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={String(r.value)}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {premiumRequired && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="font-medium">
                Recherche géolocalisée réservée au forfait Confort+
              </p>
              <Button asChild size="sm">
                <a href="/owner/money?tab=forfait">Mettre à niveau</a>
              </Button>
            </div>
          </div>
        )}

        {error && !premiumRequired && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {savedIds.size > 0 && !premiumRequired && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-xs text-emerald-900 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-200">
            <BookmarkCheck className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
            {savedIds.size} prestataire{savedIds.size > 1 ? "s" : ""} enregistré{savedIds.size > 1 ? "s" : ""} sur cet appareil. Pour partager vos favoris entre vos appareils, demandez à l'artisan de créer son compte sur talok.fr.
          </div>
        )}

        {!premiumRequired && (
          <div className="grid gap-4 lg:grid-cols-5">
            {/* Carte */}
            <div className="lg:col-span-3 rounded-xl overflow-hidden border" style={{ height: "440px" }}>
              {!isClient || !center ? (
                <div className="h-full w-full flex items-center justify-center bg-muted/50">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Localisation du bien...</span>
                  </div>
                </div>
              ) : (
                <MapContainer
                  key={`${center.lat}-${center.lng}-${radius}`}
                  center={[center.lat, center.lng]}
                  zoom={13}
                  scrollWheelZoom
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Circle
                    center={[center.lat, center.lng]}
                    radius={radius}
                    pathOptions={{
                      color: "#2563EB",
                      fillColor: "#3B82F6",
                      fillOpacity: 0.08,
                      weight: 1,
                    }}
                  />
                  {propertyIcon && (
                    <Marker
                      position={[center.lat, center.lng]}
                      icon={propertyIcon}
                    >
                      <Popup>
                        <div className="text-xs">
                          <div className="font-semibold">Votre bien</div>
                          <div className="text-muted-foreground">
                            {selectedProperty?.address}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {providerIcon &&
                    providers.map((p) => (
                      <Marker
                        key={p.id}
                        position={[p.latitude, p.longitude]}
                        icon={providerIcon}
                        eventHandlers={{
                          click: () => openDetail(p),
                        }}
                      >
                        <Popup>
                          <div className="text-xs space-y-1">
                            <div className="font-semibold">{p.name}</div>
                            {p.address && (
                              <div className="text-muted-foreground">
                                {p.address}
                              </div>
                            )}
                            {p.rating != null && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                <span>
                                  {p.rating.toFixed(1)} ({p.reviews_count ?? 0})
                                </span>
                              </div>
                            )}
                            {p.phone && <div>{p.phone}</div>}
                            <button
                              type="button"
                              onClick={() => openDetail(p)}
                              className="text-primary underline"
                            >
                              Voir le détail
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                </MapContainer>
              )}
            </div>

            {/* Listing */}
            <div className="lg:col-span-2 space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {loading ? (
                <>
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </>
              ) : providers.length === 0 ? (
                <div className="text-center py-10 text-sm text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Aucun résultat dans ce rayon. Essayez "Tout métier" ou un rayon plus large.
                </div>
              ) : (
                providers.map((p) => {
                  const isSaved = savedIds.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openDetail(p)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-primary hover:bg-primary/5 ${
                        highlightedId === p.id ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate flex items-center gap-1.5">
                            {p.name}
                            {isSaved && (
                              <BookmarkCheck className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                            )}
                          </div>
                          {p.address && (
                            <div className="text-xs text-muted-foreground truncate">
                              {p.address}
                            </div>
                          )}
                        </div>
                        {p.distance_km != null && (
                          <Badge variant="secondary" className="flex-shrink-0">
                            {p.distance_km} km
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {p.rating != null && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {p.rating.toFixed(1)}
                            {p.reviews_count != null && (
                              <span className="text-muted-foreground">
                                ({p.reviews_count} avis)
                              </span>
                            )}
                          </span>
                        )}
                        {p.is_open != null && (
                          <span
                            className={`flex items-center gap-1 ${
                              p.is_open ? "text-emerald-600" : "text-muted-foreground"
                            }`}
                          >
                            <Clock className="h-3 w-3" />
                            {p.is_open ? "Ouvert" : "Fermé"}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {p.phone && (
                          <a
                            href={`tel:${p.phone.replace(/\s/g, "")}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {p.phone}
                          </a>
                        )}
                        <a
                          href={p.google_maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Maps
                        </a>
                        <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                          Voir le détail →
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </CardContent>

      <Sheet
        open={!!detailProvider}
        onOpenChange={(open) => {
          if (!open) setDetailProvider(null);
        }}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailProvider && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-start gap-2 pr-6">
                  <span className="flex-1">{detailProvider.name}</span>
                  {savedIds.has(detailProvider.id) && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 flex-shrink-0">
                      <BookmarkCheck className="h-3 w-3 mr-1" />
                      Enregistré
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>
                  {detailProvider.address || "Adresse non communiquée"}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailProvider.distance_km != null && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Distance</div>
                      <div className="font-medium flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {detailProvider.distance_km} km
                      </div>
                    </div>
                  )}
                  {detailProvider.rating != null && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">
                        Note Google
                      </div>
                      <div className="font-medium flex items-center gap-1 mt-0.5">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {detailProvider.rating.toFixed(1)}
                        {detailProvider.reviews_count != null && (
                          <span className="text-xs text-muted-foreground font-normal ml-1">
                            ({detailProvider.reviews_count} avis)
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                  {detailProvider.is_open != null && (
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">
                        Statut
                      </div>
                      <div
                        className={`font-medium flex items-center gap-1 mt-0.5 ${
                          detailProvider.is_open
                            ? "text-emerald-600"
                            : "text-muted-foreground"
                        }`}
                      >
                        <Clock className="h-3.5 w-3.5" />
                        {detailProvider.is_open ? "Ouvert" : "Fermé"}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="text-xs text-muted-foreground">Source</div>
                    <div className="font-medium mt-0.5 capitalize">
                      {detailProvider.source === "google"
                        ? "Google Places"
                        : "Démonstration"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {detailProvider.phone && (
                    <Button asChild className="w-full justify-start" variant="default">
                      <a href={`tel:${detailProvider.phone.replace(/\s/g, "")}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        Appeler {detailProvider.phone}
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => createTicket(detailProvider)}
                  >
                    <Ticket className="h-4 w-4 mr-2" />
                    Créer un ticket pour ce prestataire
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <a
                      href={detailProvider.google_maps_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Voir sur Google Maps
                    </a>
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => copyContact(detailProvider)}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copier
                    </Button>
                    <Button
                      variant={savedIds.has(detailProvider.id) ? "secondary" : "outline"}
                      onClick={() => toggleSaved(detailProvider)}
                    >
                      {savedIds.has(detailProvider.id) ? (
                        <>
                          <BookmarkCheck className="h-4 w-4 mr-2" />
                          Enregistré
                        </>
                      ) : (
                        <>
                          <Bookmark className="h-4 w-4 mr-2" />
                          Enregistrer
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-200 flex gap-2">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    Ce prestataire provient d'une recherche externe (Google Maps). Pour profiter du suivi complet (devis, signature, paiement, avis), invitez-le à créer son compte sur <strong>talok.fr</strong>. Vos favoris sont enregistrés sur cet appareil.
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}

export default NearbyProvidersSearch;
