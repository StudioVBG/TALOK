"use client";

// =====================================================
// MapAutoFit — composant Leaflet "headless" qui ajuste le zoom de la
// carte pour que le cercle de rayon soit entièrement visible avec une
// petite marge. Doit être rendu à l'intérieur d'un <MapContainer>.
// =====================================================

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

interface MapAutoFitProps {
  /** Centre de la zone (bien sélectionné). */
  center: { lat: number; lng: number };
  /** Rayon de recherche en mètres. */
  radiusMeters: number;
}

export function MapAutoFit({ center, radiusMeters }: MapAutoFitProps) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    // L.latLng(...).toBounds(diameterMeters) crée un carré centré sur
    // le point de rayon ~diameterMeters/2 dans chaque direction. On passe
    // 2 × radius pour englober le cercle complet.
    const bounds = L.latLng(center.lat, center.lng).toBounds(radiusMeters * 2);
    // padding [20, 20] = 20 px de marge visuelle pour que le cercle ne
    // touche pas les bords de la carte.
    map.fitBounds(bounds, { padding: [20, 20], animate: true });
  }, [map, center.lat, center.lng, radiusMeters]);

  return null;
}
