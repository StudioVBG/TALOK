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
  Mail,
  MessageSquare,
  StickyNote,
  Save,
  Globe,
  RefreshCw,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { geocodeAddress } from "@/lib/services/geocoding.service";
import { formatPropertyAddress } from "@/lib/properties/address";
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

// Composant interne qui fait fitBounds sur le cercle de rayon à chaque
// changement de centre / rayon. Sans ça, MapContainer reste figé sur
// `zoom={13}` (zoom de l'init) — quand l'utilisateur élargit à 100 km
// la carte ne dézoome pas et le cercle déborde de la zone visible.
//
// Dynamique pour garder useMap dans le bundle client uniquement (Leaflet
// ne supporte pas le SSR).
const MapAutoFit = dynamic(
  () => import("./map-autofit").then((m) => m.MapAutoFit),
  { ssr: false },
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
  website?: string;
  is_open?: boolean;
  photo_url?: string;
  google_maps_url: string;
  source: "google" | "osm";
  // Tracking d'invitation (persisté côté DB via /invite). Optionnel : seuls
  // les favoris en ont, et seulement après un envoi réussi.
  last_invite_at?: string | null;
  invite_count?: number | null;
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
  // Pilotage externe (parent = source de vérité). Quand fournis, le composant
  // n'affiche plus son propre sélecteur de bien ni de rayon, et n'appelle plus
  // /api/properties ni geocodeAddress (déjà fait par le parent).
  controlledProperty?: PropertyOption | null;
  controlledCenter?: { lat: number; lng: number } | null;
  // Permet de différencier "géocoding en cours" (skeleton) de
  // "géocoding échoué" (message d'erreur).
  controlledCenterLoading?: boolean;
  controlledRadiusKm?: number;
  // Permet au composant de demander au parent d'augmenter le rayon
  // (ex. bouton "Élargir à 50 km" affiché quand 0 résultat).
  onRequestRadiusKm?: (radiusKm: number) => void;
  // Pour adapter le titre : "Aucun prestataire référencé" vs "Compléter les
  // prestataires Talok par les artisans à proximité".
  hasTalokProviders?: boolean;
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

// Format compact d'une date d'invitation pour le badge — au-delà de 30 jours
// on affiche la date courte, sinon "il y a X jours" pour rester lisible.
function formatInviteDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  return `le ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`;
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
  controlledProperty,
  controlledCenter,
  controlledCenterLoading = false,
  controlledRadiusKm,
  onRequestRadiusKm,
  hasTalokProviders = false,
}: NearbyProvidersSearchProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isControlled = controlledProperty !== undefined;
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertiesLoading, setPropertiesLoading] = useState(!isControlled);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [category, setCategory] = useState<string>(normalizeCategory(initialCategory));
  // Rayon en mètres (Google Places + Overpass attendent des mètres).
  // Quand le parent pilote, on dérive ce rayon depuis controlledRadiusKm.
  const [radius, setRadius] = useState<number>(
    controlledRadiusKm ? controlledRadiusKm * 1000 : 10000,
  );

  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(
    controlledCenter ?? null,
  );
  const [providers, setProviders] = useState<NearbyProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<"google" | "cache" | "osm" | null>(null);
  const [premiumRequired, setPremiumRequired] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [detailProvider, setDetailProvider] = useState<NearbyProvider | null>(null);
  const [detailNotes, setDetailNotes] = useState<string>("");
  const [detailNotesLoaded, setDetailNotesLoaded] = useState<string>("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [propertyIcon, setPropertyIcon] = useState<any>(null);
  const [providerIcon, setProviderIcon] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  // Dialog d'invitation in-app (remplace l'ancien mailto: qui sortait
  // l'utilisateur vers son client mail). Le mail part de no-reply@talok.fr.
  const [inviteProvider, setInviteProvider] = useState<NearbyProvider | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [inviteSending, setInviteSending] = useState(false);

  // Hydratation immédiate depuis localStorage (UI réactive sans flash),
  // puis réconciliation avec le serveur (source de vérité multi-appareils).
  useEffect(() => {
    setSavedIds(readSavedIds());
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/providers/external-favorites");
        if (!res.ok) return;
        const data = await res.json();
        const ids = new Set<string>(
          (data?.favorites ?? []).map((f: any) => f.place_id as string),
        );
        if (cancelled) return;
        setSavedIds(ids);
        writeSavedIds(ids);
      } catch (err) {
        console.warn("[NearbyProvidersSearch] Sync favoris échouée:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openDetail = async (provider: NearbyProvider) => {
    setHighlightedId(provider.id);
    setDetailProvider(provider);
    setDetailNotes("");
    setDetailNotesLoaded("");

    // Si déjà en favori, charger les notes existantes + champs persistés
    // (website, phone) qui ne sont pas dans le résultat Text Search.
    if (savedIds.has(provider.id)) {
      try {
        const res = await fetch("/api/providers/external-favorites");
        if (res.ok) {
          const data = await res.json();
          const found = (data?.favorites ?? []).find(
            (f: any) => f.place_id === provider.id,
          );
          const notes = (found?.notes as string) ?? "";
          setDetailNotes(notes);
          setDetailNotesLoaded(notes);
          if (found) {
            setDetailProvider((prev) =>
              prev && prev.id === provider.id
                ? {
                    ...prev,
                    website: prev.website ?? found.website ?? undefined,
                    phone: prev.phone ?? found.phone ?? undefined,
                    last_invite_at: found.last_invite_at ?? null,
                    invite_count: found.invite_count ?? 0,
                  }
                : prev,
            );
          }
        }
      } catch (err) {
        console.warn("[NearbyProvidersSearch] Lecture notes échouée:", err);
      }
    }

    // Le Text Search Google ne renvoie ni site web ni téléphone : on
    // enrichit la fiche via Place Details (cache 24h côté serveur).
    if (provider.source === "google" && (!provider.website || !provider.phone)) {
      try {
        const res = await fetch(
          `/api/providers/place-details/${encodeURIComponent(provider.id)}`,
        );
        if (res.ok) {
          const data = await res.json();
          const details = data?.details ?? {};
          if (details.website || details.phone) {
            setDetailProvider((prev) =>
              prev && prev.id === provider.id
                ? {
                    ...prev,
                    website: prev.website ?? details.website ?? undefined,
                    phone: prev.phone ?? details.phone ?? undefined,
                  }
                : prev,
            );
          }
        }
      } catch (err) {
        console.warn("[NearbyProvidersSearch] Lecture détails échouée:", err);
      }
    }
  };

  const saveNotes = async (provider: NearbyProvider) => {
    setSavingNotes(true);
    try {
      const res = await fetch(
        `/api/providers/external-favorites/${encodeURIComponent(provider.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: detailNotes.trim() || null }),
        },
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      setDetailNotesLoaded(detailNotes);
      toast({
        title: "Notes enregistrées",
        description: `Vos notes sur ${provider.name} ont été sauvegardées.`,
      });
    } catch (err) {
      console.error("[NearbyProvidersSearch] Sauvegarde notes échouée:", err);
      toast({
        title: "Sauvegarde impossible",
        description: "Réessayez dans un instant.",
        variant: "destructive",
      });
    } finally {
      setSavingNotes(false);
    }
  };

  const openInviteDialog = (provider: NearbyProvider) => {
    // Pré-condition : le prestataire doit être en favori (la route serveur
    // l'exige pour éviter le spam). On s'en assure proactivement ici plutôt
    // que d'attendre l'erreur 404.
    if (!savedIds.has(provider.id)) {
      toast({
        title: "Enregistrez d'abord ce prestataire",
        description: "Cliquez sur ‟Enregistrer” avant de l'inviter sur Talok.",
        variant: "destructive",
      });
      return;
    }
    setInviteProvider(provider);
    setInviteEmail("");
    setInviteMessage("");
  };

  const submitInvite = async () => {
    if (!inviteProvider) return;
    setInviteSending(true);
    try {
      const res = await fetch(
        `/api/providers/external-favorites/${encodeURIComponent(inviteProvider.id)}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: inviteEmail.trim(),
            custom_message: inviteMessage.trim() || undefined,
          }),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "HTTP " + res.status);
      }
      toast({
        title: "Invitation envoyée",
        description: `Un email a été envoyé à ${inviteEmail}.`,
      });
      setInviteProvider(null);
    } catch (err) {
      console.error("[NearbyProvidersSearch] Invitation échouée:", err);
      toast({
        title: "Envoi impossible",
        description:
          err instanceof Error ? err.message : "Réessayez dans un instant.",
        variant: "destructive",
      });
    } finally {
      setInviteSending(false);
    }
  };

  const inviteBySms = (provider: NearbyProvider) => {
    if (!provider.phone) return;
    const body = `Bonjour ${provider.name}, je vous invite à créer un compte prestataire gratuit sur Talok pour gérer ensemble devis et interventions : https://talok.fr/auth/register?role=provider`;
    const phoneClean = provider.phone.replace(/\s/g, "");
    window.location.href = `sms:${phoneClean}?body=${encodeURIComponent(body)}`;
  };

  const toggleSaved = async (provider: NearbyProvider) => {
    const wasSaved = savedIds.has(provider.id);

    // Optimistic update
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (wasSaved) next.delete(provider.id);
      else next.add(provider.id);
      writeSavedIds(next);
      return next;
    });

    try {
      if (wasSaved) {
        const res = await fetch(
          `/api/providers/external-favorites/${encodeURIComponent(provider.id)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("HTTP " + res.status);
        toast({
          title: "Prestataire retiré",
          description: `${provider.name} ne fait plus partie de vos favoris.`,
        });
      } else {
        const res = await fetch("/api/providers/external-favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            place_id: provider.id,
            name: provider.name,
            category,
            address: provider.address ?? null,
            phone: provider.phone ?? null,
            website: provider.website ?? null,
            latitude: provider.latitude,
            longitude: provider.longitude,
            rating: provider.rating ?? null,
            reviews_count: provider.reviews_count ?? null,
            google_maps_url: provider.google_maps_url,
            source: provider.source,
          }),
        });
        if (!res.ok) throw new Error("HTTP " + res.status);
        toast({
          title: "Prestataire enregistré",
          description: `${provider.name} a été ajouté à vos favoris.`,
        });
      }
    } catch (err) {
      console.error("[NearbyProvidersSearch] Toggle favori échoué:", err);
      // Rollback
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(provider.id);
        else next.delete(provider.id);
        writeSavedIds(next);
        return next;
      });
      toast({
        title: "Action impossible",
        description: "La synchronisation avec le serveur a échoué.",
        variant: "destructive",
      });
    }
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
    () =>
      isControlled
        ? controlledProperty ?? null
        : properties.find((p) => p.id === selectedPropertyId) ?? null,
    [isControlled, controlledProperty, properties, selectedPropertyId],
  );

  // Décale légèrement les markers superposés (mêmes coords ou très proches).
  // Sans ça, 3 artisans dans le même immeuble ne donnent qu'un seul pin
  // cliquable. On regroupe par lat/lng arrondis à 4 décimales (~11 m), puis
  // on dispose en cercle de ~13 m autour du point d'origine. Les coords
  // réelles utilisées pour la distance restent celles de `providers`.
  const displayedProviders = useMemo<NearbyProvider[]>(() => {
    const groups = new Map<string, NearbyProvider[]>();
    for (const p of providers) {
      const key = `${p.latitude.toFixed(4)},${p.longitude.toFixed(4)}`;
      const arr = groups.get(key);
      if (arr) arr.push(p);
      else groups.set(key, [p]);
    }

    const result: NearbyProvider[] = [];
    for (const group of groups.values()) {
      if (group.length === 1) {
        result.push(group[0]);
        continue;
      }
      // ~13 m de rayon. 0.00012° de latitude ≈ 13.3 m partout.
      const radiusDeg = 0.00012;
      for (let i = 0; i < group.length; i++) {
        const angle = (2 * Math.PI * i) / group.length;
        result.push({
          ...group[i],
          latitude: group[i].latitude + radiusDeg * Math.cos(angle),
          longitude: group[i].longitude + radiusDeg * Math.sin(angle),
        });
      }
    }
    return result;
  }, [providers]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Sync rayon contrôlé (km → m).
  useEffect(() => {
    if (controlledRadiusKm != null) setRadius(controlledRadiusKm * 1000);
  }, [controlledRadiusKm]);

  // Sync centre contrôlé.
  useEffect(() => {
    if (controlledCenter !== undefined) setCenter(controlledCenter);
  }, [controlledCenter]);

  // Charger les biens du propriétaire — sauté en mode contrôlé (le parent a
  // déjà chargé /api/properties + géocodé, on évite ainsi le double appel).
  useEffect(() => {
    if (isControlled) return;
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
            address: formatPropertyAddress(p.adresse_complete, p.code_postal, p.ville),
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
  }, [isControlled]);

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

  // Géocoder l'adresse du bien sélectionné si pas déjà fait — sauté en mode
  // contrôlé (le parent fournit déjà `controlledCenter`).
  useEffect(() => {
    if (isControlled) return;
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
  }, [isControlled, selectedProperty]);

  // Compteur d'actualisations manuelles : incrémenté par le bouton "Actualiser",
  // sert de dépendance au useEffect pour re-déclencher une recherche bypass cache.
  const [refreshNonce, setRefreshNonce] = useState(0);

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
        // Le 1er appel utilise le cache (rapide). Toute pression sur "Actualiser"
        // ajoute ?fresh=1 pour bypass le cache Redis 24 h et refaire un vrai
        // call Google/OSM — utile quand Marie-Line a changé la zone ou quand
        // on suspecte un cache 0-result poisoning.
        if (refreshNonce > 0) params.set("fresh", "1");
        const res = await fetch(`/api/providers/nearby?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.status === 403 && data?.error === "premium_required") {
          setPremiumRequired(true);
          setProviders([]);
          setDataSource(null);
        } else if (res.status === 429) {
          // Rate-limit explicite — on utilise le toast plutôt que le banner
          // rouge "erreur" pour signaler que c'est temporaire et lié à la
          // fréquence d'usage (pas à un bug Talok).
          toast({
            title: "Trop de recherches",
            description: "Limite quotidienne Google atteinte. Réessayez dans environ une heure.",
            variant: "destructive",
          });
          setProviders([]);
          setDataSource(null);
        } else if (!res.ok) {
          setError(data?.error || "Erreur lors de la recherche");
          setProviders([]);
          setDataSource(null);
        } else {
          setProviders(data.providers || []);
          setDataSource((data?.source as "google" | "cache" | "osm") ?? null);
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
  }, [center, category, radius, selectedProperty, refreshNonce]);

  if (!isControlled && propertiesLoading) {
    return (
      <Card className={className}>
        <CardContent className="py-8 space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!isControlled && properties.length === 0) {
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

  // En mode contrôlé, le parent gère le cas "pas de bien sélectionné" — on
  // affiche un placeholder léger plutôt qu'un Card vide qui désaligne le layout.
  if (isControlled && !selectedProperty) {
    return null;
  }

  // Si le parent a fourni un bien mais que le géocodage a échoué (rare en
  // DROM-COM avec une adresse mal formée), on aide l'utilisateur à corriger
  // au lieu de boucler sur un loader silencieux (BUG audit #5).
  // controlledCenterLoading distingue "Nominatim en cours" (skeleton) de
  // "Nominatim a renvoyé null" (vrai échec).
  if (isControlled && selectedProperty && controlledCenter === null) {
    if (controlledCenterLoading) {
      return (
        <Card className={className}>
          <CardContent className="py-8 space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className={className}>
        <CardContent className="py-8 text-center space-y-2">
          <MapPin className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-medium">Bien non géolocalisé</h3>
          <p className="text-sm text-muted-foreground">
            L'adresse <strong>{selectedProperty.address}</strong> n'a pas pu être trouvée. Vérifiez l'orthographe sur la fiche du bien (Mes biens → Modifier).
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
            {hasTalokProviders
              ? "Complétez les prestataires Talok ci-dessus avec les artisans et entreprises à proximité du bien sélectionné."
              : "Aucun prestataire Talok inscrit dans la zone — voici les artisans et entreprises à proximité du bien sélectionné."}
          </p>
        </div>

        {/* Filtres — sélecteur Métier uniquement en mode contrôlé (le parent
            pilote le bien et le rayon pour éviter les doublons). */}
        <div className={isControlled ? "max-w-sm" : "grid gap-3 md:grid-cols-3"}>
          {!isControlled && (
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
          )}
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
          {!isControlled && (
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
          )}
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
            {savedIds.size} prestataire{savedIds.size > 1 ? "s" : ""} enregistré{savedIds.size > 1 ? "s" : ""} dans vos favoris (synchronisés sur tous vos appareils).
          </div>
        )}

        {dataSource === "osm" && !premiumRequired && providers.length > 0 && (
          <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs text-sky-900 dark:bg-sky-950/20 dark:border-sky-900 dark:text-sky-200 flex gap-2">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              Résultats issus d'<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>. Les coordonnées et coordonnées de contact proviennent des contributions publiques de la communauté.
            </span>
          </div>
        )}

        {dataSource && providers.length === 0 && !loading && !premiumRequired && !error && (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Aucun prestataire trouvé pour cette catégorie dans un rayon de {Math.round(radius / 1000)} km.
              </span>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              {/* Refresh manuel : bypass cache 24 h. Utile quand le résultat
                  est cached à 0 par accident (Google transient down,
                  Overpass timeout) et que l'utilisateur sait qu'il devrait y
                  avoir des artisans dans la zone. */}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setRefreshNonce((n) => n + 1)}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Actualiser
              </Button>
              {/* Bouton "élargir auto" : 5/10/20 → 50, 30/50 → 100. */}
              {(() => {
                const currentKm = Math.round(radius / 1000);
                const nextKm = currentKm < 20 ? 50 : currentKm < 50 ? 100 : null;
                if (!nextKm) return null;
                const handleExpand = () => {
                  if (isControlled && onRequestRadiusKm) {
                    onRequestRadiusKm(nextKm);
                  } else {
                    setRadius(nextKm * 1000);
                  }
                };
                return (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExpand}
                  >
                    Élargir à {nextKm} km
                  </Button>
                );
              })()}
            </div>
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
                  // Zoom initial très large — MapAutoFit ajuste précisément
                  // au cercle après mount.
                  zoom={11}
                  scrollWheelZoom
                  style={{ height: "100%", width: "100%" }}
                >
                  <MapAutoFit center={center} radiusMeters={radius} />
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
                    displayedProviders.map((p) => (
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
                <SheetTitle className="flex flex-wrap items-start gap-2 pr-6">
                  <span className="flex-1">{detailProvider.name}</span>
                  {savedIds.has(detailProvider.id) && (
                    <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 flex-shrink-0">
                      <BookmarkCheck className="h-3 w-3 mr-1" />
                      Enregistré
                    </Badge>
                  )}
                  {detailProvider.last_invite_at && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 flex-shrink-0">
                      <Mail className="h-3 w-3 mr-1" />
                      Invité {formatInviteDate(detailProvider.last_invite_at)}
                      {detailProvider.invite_count && detailProvider.invite_count > 1
                        ? ` (×${detailProvider.invite_count})`
                        : ""}
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
                  {detailProvider.website && (
                    <Button asChild variant="outline" className="w-full justify-start">
                      <a
                        href={detailProvider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="h-4 w-4 mr-2" />
                        Visiter le site web
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

                {/* Notes — visibles uniquement quand le prestataire est enregistré */}
                {savedIds.has(detailProvider.id) && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-xs font-medium flex items-center gap-1.5">
                      <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                      Notes privées
                    </label>
                    <Textarea
                      value={detailNotes}
                      onChange={(e) => setDetailNotes(e.target.value)}
                      placeholder="Ex. Recommandé par le voisin du 1er, intervient sous 24h, prix corrects."
                      rows={3}
                      maxLength={2000}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {detailNotes.length}/2000
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={savingNotes || detailNotes === detailNotesLoaded}
                        onClick={() => saveNotes(detailProvider)}
                      >
                        {savingNotes ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Save className="h-3.5 w-3.5 mr-1.5" />
                        )}
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                )}

                {/* Invitation à rejoindre Talok */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-xs font-medium text-muted-foreground">
                    Inviter ce prestataire sur Talok
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => openInviteDialog(detailProvider)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!detailProvider.phone}
                      onClick={() => inviteBySms(detailProvider)}
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      SMS
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 text-xs text-blue-900 dark:bg-blue-950/20 dark:border-blue-900 dark:text-blue-200 flex gap-2">
                  <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <div>
                    Ce prestataire provient d'une recherche externe (Google Maps). Une fois inscrit sur Talok, vous pourrez échanger devis, factures et photos d'intervention en suivi complet. Vos favoris et notes sont synchronisés sur tous vos appareils.
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Dialog d'invitation in-app — remplace l'ancien mailto: pour que le
          mail parte de no-reply@talok.fr (deliverability + tracking UTM). */}
      <Dialog
        open={!!inviteProvider}
        onOpenChange={(open) => {
          if (!open) setInviteProvider(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter sur Talok</DialogTitle>
            <DialogDescription>
              {inviteProvider
                ? `${inviteProvider.name} recevra un email d'invitation depuis Talok avec un lien pour créer sa fiche prestataire gratuite.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="invite-email">
                Email du prestataire *
              </label>
              <Input
                id="invite-email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="contact@artisan.fr"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="invite-message">
                Message personnalisé (optionnel)
              </label>
              <Textarea
                id="invite-message"
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                placeholder="Ex. : Bonjour, j'ai 3 biens en location à Fort-de-France et j'aimerais vous y associer pour les interventions futures."
                rows={3}
                maxLength={2000}
              />
              <div className="text-right text-xs text-muted-foreground">
                {inviteMessage.length}/2000
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setInviteProvider(null)}
              disabled={inviteSending}
            >
              Annuler
            </Button>
            <Button
              onClick={submitInvite}
              disabled={inviteSending || !inviteEmail.trim()}
            >
              {inviteSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Envoi…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Envoyer l'invitation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default NearbyProvidersSearch;
