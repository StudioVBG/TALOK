/**
 * Service Worker Serwist — successeur de next-pwa
 *
 * Strategies de cache reproduites depuis l'ancien next-pwa :
 * - Google Fonts : CacheFirst (1 an)
 * - Supabase Storage : StaleWhileRevalidate (30 jours)
 * - Images statiques : StaleWhileRevalidate (24h)
 */

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist, StaleWhileRevalidate } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Google Fonts — CacheFirst, 1 an
    {
      matcher: ({ url }) =>
        url.origin === "https://fonts.googleapis.com" ||
        url.origin === "https://fonts.gstatic.com",
      handler: new CacheFirst({
        cacheName: "google-fonts",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 10,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 an
          }),
        ],
      }),
    },
    // Supabase Storage — StaleWhileRevalidate, 30 jours
    {
      matcher: ({ url }) =>
        url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/"),
      handler: new StaleWhileRevalidate({
        cacheName: "supabase-storage",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 jours
          }),
        ],
      }),
    },
    // Images statiques — StaleWhileRevalidate, 24h
    {
      matcher: ({ url }) =>
        /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: "static-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 64,
            maxAgeSeconds: 24 * 60 * 60, // 24h
          }),
        ],
      }),
    },
    // Default cache pour les autres requetes
    ...defaultCache,
  ],
});

serwist.addEventListeners();
