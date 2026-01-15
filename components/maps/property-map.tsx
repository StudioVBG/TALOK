"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Navigation, ZoomIn, ZoomOut, Maximize2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { geocodeAddress, isValidCoordinates } from "@/lib/services/geocoding.service";

// Import CSS de Leaflet - IMPORTANT pour l'affichage des tuiles
import "leaflet/dist/leaflet.css";

// Types pour les props
interface PropertyMapProps {
  latitude?: number | null;
  longitude?: number | null;
  address: string; // Requis pour le géocodage automatique
  className?: string;
  height?: string;
  zoom?: number;
  interactive?: boolean;
  showControls?: boolean;
  markerColor?: "primary" | "blue" | "green" | "red" | "orange";
}

// Import dynamique pour éviter les erreurs SSR avec Leaflet
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);

const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);

const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// Composant de skeleton pour le chargement
function MapSkeleton({ height, className }: { height: string; className?: string }) {
  return (
    <div className={cn("relative rounded-xl overflow-hidden", className)} style={{ height }}>
      <Skeleton className="w-full h-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <MapPin className="h-8 w-8 animate-pulse" />
          <span className="text-sm">Chargement de la carte...</span>
        </div>
      </div>
    </div>
  );
}

// Couleurs des marqueurs
const markerColors = {
  primary: "#7c3aed", // violet
  blue: "#3b82f6",
  green: "#22c55e",
  red: "#ef4444",
  orange: "#f97316",
};

export function PropertyMap({
  latitude,
  longitude,
  address,
  className,
  height = "300px",
  zoom = 15,
  interactive = true,
  showControls = true,
  markerColor = "primary",
}: PropertyMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [mapZoom, setMapZoom] = useState(zoom);
  const [customIcon, setCustomIcon] = useState<any>(null);
  
  // État pour le géocodage
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    isValidCoordinates(latitude, longitude) 
      ? { lat: latitude!, lng: longitude! } 
      : null
  );
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeAttempted, setGeocodeAttempted] = useState(false);
  const geocodeRef = useRef(false);

  // Géocodage automatique si pas de coordonnées
  useEffect(() => {
    // Ne géocode qu'une seule fois par adresse
    if (coords || geocodeRef.current || !address || geocodeAttempted) return;
    
    geocodeRef.current = true;
    setIsGeocoding(true);
    
    geocodeAddress(address)
      .then((result) => {
        if (result) {
          setCoords({ lat: result.latitude, lng: result.longitude });
        }
      })
      .catch(console.error)
      .finally(() => {
        setIsGeocoding(false);
        setGeocodeAttempted(true);
      });
  }, [address, coords, geocodeAttempted]);

  // Mettre à jour les coords si les props changent
  useEffect(() => {
    if (isValidCoordinates(latitude, longitude)) {
      setCoords({ lat: latitude!, lng: longitude! });
    }
  }, [latitude, longitude]);

  useEffect(() => {
    setIsClient(true);
    
    // Créer l'icône personnalisée côté client uniquement
    if (typeof window !== "undefined") {
      import("leaflet").then((L) => {
        const icon = L.divIcon({
          className: "custom-marker",
          html: `
            <div style="
              width: 36px;
              height: 36px;
              background: ${markerColors[markerColor]};
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              border: 3px solid white;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <div style="
                transform: rotate(45deg);
                color: white;
                font-size: 16px;
              ">📍</div>
            </div>
          `,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        });
        setCustomIcon(icon);
      });
    }
  }, [markerColor]);

  // Affichage pendant le géocodage
  if (isGeocoding) {
    return (
      <div 
        className={cn(
          "relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border flex items-center justify-center",
          className
        )} 
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="relative">
            <MapPin className="h-10 w-10 text-primary/30" />
            <Loader2 className="h-5 w-5 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin text-primary" />
          </div>
          <p className="text-sm font-medium">Géolocalisation en cours...</p>
          <p className="text-xs text-muted-foreground/70 max-w-[200px] text-center">{address}</p>
        </div>
      </div>
    );
  }

  // Validation des coordonnées - afficher un message si pas de coords
  if (!coords) {
    return (
      <div 
        className={cn(
          "relative rounded-xl overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 border border-dashed flex items-center justify-center",
          className
        )} 
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground p-6 text-center">
          <MapPin className="h-10 w-10 opacity-50" />
          <p className="text-sm font-medium">Localisation non disponible</p>
          <p className="text-xs max-w-[250px]">
            Impossible de localiser cette adresse. Vérifiez qu'elle est correctement renseignée.
          </p>
        </div>
      </div>
    );
  }

  if (!isClient) {
    return <MapSkeleton height={height} className={className} />;
  }

  const handleZoomIn = () => setMapZoom((prev) => Math.min(prev + 1, 18));
  const handleZoomOut = () => setMapZoom((prev) => Math.max(prev - 1, 1));
  const handleOpenMaps = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`,
      "_blank"
    );
  };

  return (
    <div className={cn("relative rounded-xl overflow-hidden group", className)} style={{ height }}>
      {/* Styles CSS additionnels pour Leaflet */}
      <style jsx global>{`
        .leaflet-container {
          height: 100%;
          width: 100%;
          border-radius: 0.75rem;
          z-index: 1;
        }
        
        .leaflet-control-zoom {
          display: none !important;
        }
        
        .leaflet-control-attribution {
          font-size: 9px !important;
          background: rgba(255,255,255,0.8) !important;
          padding: 2px 6px !important;
        }
        
        .custom-marker {
          background: transparent !important;
          border: none !important;
        }
        
        .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        
        .leaflet-popup-content {
          margin: 12px 16px;
          font-family: inherit;
        }
        
        .leaflet-popup-tip {
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        }
        
        .leaflet-tile-pane {
          z-index: 1;
        }
      `}</style>

      <MapContainer
        center={[coords.lat, coords.lng]}
        zoom={mapZoom}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {customIcon && (
          <Marker position={[coords.lat, coords.lng]} icon={customIcon}>
            {address && (
              <Popup>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-sm">📍 Localisation</span>
                  <span className="text-xs text-muted-foreground">{address}</span>
                </div>
              </Popup>
            )}
          </Marker>
        )}
      </MapContainer>

      {/* Contrôles personnalisés */}
      {showControls && (
        <div className="absolute top-3 right-3 flex flex-col gap-2 z-[1000] opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white shadow-md"
            onClick={handleZoomIn}
            aria-label="Zoomer"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white shadow-md"
            onClick={handleZoomOut}
            aria-label="Dézoomer"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-8 w-8 bg-white/90 hover:bg-white shadow-md"
            onClick={handleOpenMaps}
            title="Ouvrir dans Google Maps"
            aria-label="Ouvrir dans Google Maps"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Badge de localisation */}
      <div className="absolute bottom-3 left-3 z-[1000]">
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-md text-xs font-medium">
          <Navigation className="h-3 w-3 text-primary" />
          <span>OpenStreetMap</span>
        </div>
      </div>
    </div>
  );
}

// Export par défaut avec chargement dynamique (pour éviter erreurs SSR)
export default PropertyMap;
