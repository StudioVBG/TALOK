"use client";

// =====================================================
// Mini-carte Leaflet pour la page détail prestataire.
// Affiche la position géocodée de l'artisan (marker)
// et son rayon d'intervention (cercle).
// =====================================================

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false },
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false },
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false },
);
const Popup = dynamic(
  () => import("react-leaflet").then((m) => m.Popup),
  { ssr: false },
);
const Circle = dynamic(
  () => import("react-leaflet").then((m) => m.Circle),
  { ssr: false },
);

interface ProviderLocationMapProps {
  latitude: number;
  longitude: number;
  name: string;
  address?: string | null;
  serviceRadiusKm?: number | null;
  className?: string;
}

export function ProviderLocationMap({
  latitude,
  longitude,
  name,
  address,
  serviceRadiusKm,
  className = "",
}: ProviderLocationMapProps) {
  const [providerIcon, setProviderIcon] = useState<unknown>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("leaflet").then((L) => {
      setProviderIcon(
        L.divIcon({
          className: "talok-marker-provider-detail",
          html: `<div style="
            width: 36px; height: 36px;
            background: #f97316;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
          "><div style="transform: rotate(45deg); color: white; font-size: 16px;">🔧</div></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 36],
          popupAnchor: [0, -36],
        }),
      );
    });
  }, []);

  // Calcul d'un zoom adapté au rayon d'intervention :
  // plus le rayon est large, plus on dézoome pour le voir entier.
  const zoom =
    serviceRadiusKm == null
      ? 14
      : serviceRadiusKm <= 10
        ? 12
        : serviceRadiusKm <= 30
          ? 10
          : serviceRadiusKm <= 60
            ? 9
            : 8;

  return (
    <div className={`relative rounded-xl overflow-hidden border ${className}`}>
      {isClient ? (
        <div style={{ height: 280, width: "100%" }}>
          <MapContainer
            center={[latitude, longitude]}
            zoom={zoom}
            scrollWheelZoom={false}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {serviceRadiusKm != null && serviceRadiusKm > 0 && (
              <Circle
                center={[latitude, longitude]}
                radius={serviceRadiusKm * 1000}
                pathOptions={{
                  color: "#f97316",
                  fillColor: "#f97316",
                  fillOpacity: 0.08,
                  weight: 1.5,
                }}
              />
            )}
            {providerIcon != null && (
              <Marker position={[latitude, longitude]} icon={providerIcon as any}>
                <Popup>
                  <div className="text-sm">
                    <strong>{name}</strong>
                    {address && <div className="text-xs mt-1">{address}</div>}
                  </div>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </div>
      ) : (
        <div
          style={{ height: 280 }}
          className="w-full bg-muted/40 flex items-center justify-center text-sm text-muted-foreground"
        >
          Chargement de la carte…
        </div>
      )}

      <Button
        variant="secondary"
        size="sm"
        asChild
        className="absolute top-3 right-3 shadow-md z-[1000]"
      >
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Google Maps
        </a>
      </Button>
    </div>
  );
}
