"use client";

import { AgencyThemeProvider } from "@/components/agency/AgencyThemeProvider";
import { useWhiteLabelConfig } from "@/lib/hooks/use-whitelabel-config";

/**
 * Client wrapper that loads the white-label config and applies
 * dynamic CSS variables via AgencyThemeProvider.
 */
export function AgencyThemeWrapper({ children }: { children: React.ReactNode }) {
  const { config } = useWhiteLabelConfig();

  // If no config or still loading, render children without theming
  if (!config) {
    return <>{children}</>;
  }

  return (
    <AgencyThemeProvider
      primaryColor={config.primary_color}
      secondaryColor={config.secondary_color || undefined}
      fontFamily={config.font_family}
      logoUrl={config.logo_url}
      brandName={config.brand_name}
    >
      {children}
    </AgencyThemeProvider>
  );
}
