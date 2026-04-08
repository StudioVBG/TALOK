"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "@capacitor/app";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();
  const router = useRouter();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Masquer le splash screen une fois l'app chargée
    const initCapacitor = async () => {
      try {
        await SplashScreen.hide();

        // Configurer la barre de statut en fonction du thème
        if (theme === "dark") {
          await StatusBar.setStyle({ style: Style.Dark });
          if (Capacitor.getPlatform() === "android") {
            await StatusBar.setBackgroundColor({ color: "#0F172A" });
          }
        } else {
          await StatusBar.setStyle({ style: Style.Light });
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation de Capacitor:", error);
      }
    };

    initCapacitor();

    // Gérer le bouton retour sur Android
    const backButtonListener = App.addListener("backButton", (data) => {
      if (!data.canGoBack) {
        App.exitApp();
      } else {
        window.history.back();
      }
    });

    // Gérer les deep links (Universal Links / App Links)
    const appUrlListener = App.addListener("appUrlOpen", (event) => {
      try {
        const url = new URL(event.url);
        const path = url.pathname;
        if (path) {
          router.push(path);
        }
      } catch {
        // URL invalide, ignorer
      }
    });

    // Détection réseau via @capacitor/network
    let networkCleanup: (() => void) | undefined;
    import("@capacitor/network")
      .then(({ Network }) => {
        Network.getStatus().then((status) => setIsOnline(status.connected));
        Network.addListener("networkStatusChange", (status) => {
          setIsOnline(status.connected);
        }).then((listener) => {
          networkCleanup = () => listener.remove();
        });
      })
      .catch(() => {
        // Plugin not available, assume online
      });

    return () => {
      backButtonListener.then((listener) => listener.remove());
      appUrlListener.then((listener) => listener.remove());
      networkCleanup?.();
    };
  }, [theme, router]);

  if (!isOnline && Capacitor.isNativePlatform()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-center">
        <div>
          <p className="text-lg font-semibold text-white">Pas de connexion</p>
          <p className="mt-2 text-sm text-slate-400">
            Vérifiez votre connexion internet et réessayez.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

