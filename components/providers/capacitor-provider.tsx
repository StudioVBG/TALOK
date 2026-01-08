"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { App } from "@capacitor/app";
import { useTheme } from "next-themes";

export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Masquer le splash screen une fois l'app chargée
    const initCapacitor = async () => {
      try {
        await SplashScreen.hide();
        
        // Configurer la barre de statut en fonction du thème
        if (theme === "dark") {
          await StatusBar.setStyle({ style: Style.Dark });
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

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, [theme]);

  return <>{children}</>;
}

