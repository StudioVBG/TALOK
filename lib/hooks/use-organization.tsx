"use client";

import * as React from "react";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { Organization } from "@/lib/types/multi-company";

interface OrganizationContextValue {
  organizations: Organization[];
  currentOrganization: Organization | null;
  currentOrganizationId: string | null;
  propertyCountByOrg: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  setCurrentOrganizationId: (id: string) => void;
  refreshOrganizations: () => Promise<void>;
  createOrganization: (data: Partial<Organization>) => Promise<Organization>;
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null);

const STORAGE_KEY = "currentOrganizationId";

interface OrganizationProviderProps {
  children: React.ReactNode;
  initialOrganizations?: Organization[];
  initialPropertyCounts?: Record<string, number>;
}

export function OrganizationProvider({
  children,
  initialOrganizations = [],
  initialPropertyCounts = {},
}: OrganizationProviderProps) {
  const [organizations, setOrganizations] = useState<Organization[]>(initialOrganizations);
  const [propertyCountByOrg, setPropertyCountByOrg] = useState<Record<string, number>>(initialPropertyCounts);
  const [currentOrganizationId, setCurrentOrganizationIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!initialOrganizations.length);
  const [error, setError] = useState<string | null>(null);

  // Charger l'ID sauvegardé au montage
  useEffect(() => {
    const savedId = localStorage.getItem(STORAGE_KEY);
    if (savedId && organizations.some((org) => org.id === savedId)) {
      setCurrentOrganizationIdState(savedId);
    } else if (organizations.length > 0) {
      // Sélectionner l'organisation par défaut
      const defaultOrg = organizations.find((org) => org.is_default) || organizations[0];
      setCurrentOrganizationIdState(defaultOrg.id);
    }
  }, [organizations]);

  // Charger les organisations si pas de données initiales
  useEffect(() => {
    if (initialOrganizations.length === 0) {
      refreshOrganizations();
    }
  }, []);

  const setCurrentOrganizationId = useCallback((id: string) => {
    setCurrentOrganizationIdState(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  const refreshOrganizations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/owner/organizations");
      if (!response.ok) {
        throw new Error("Erreur lors du chargement des organisations");
      }

      const data = await response.json();
      setOrganizations(data.organizations || []);
      setPropertyCountByOrg(data.propertyCountByOrg || {});

      // Mettre à jour l'organisation courante si nécessaire
      if (data.organizations?.length > 0) {
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (!savedId || !data.organizations.some((org: Organization) => org.id === savedId)) {
          const defaultOrg = data.organizations.find((org: Organization) => org.is_default) || data.organizations[0];
          setCurrentOrganizationIdState(defaultOrg.id);
          localStorage.setItem(STORAGE_KEY, defaultOrg.id);
        }
      }
    } catch (err: any) {
      console.error("Erreur chargement organisations:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createOrganization = useCallback(async (data: Partial<Organization>): Promise<Organization> => {
    const response = await fetch("/api/owner/organizations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Erreur lors de la création");
    }

    const { organization } = await response.json();

    // Rafraîchir la liste
    await refreshOrganizations();

    return organization;
  }, [refreshOrganizations]);

  const currentOrganization = organizations.find((org) => org.id === currentOrganizationId) || null;

  const value: OrganizationContextValue = {
    organizations,
    currentOrganization,
    currentOrganizationId,
    propertyCountByOrg,
    isLoading,
    error,
    setCurrentOrganizationId,
    refreshOrganizations,
    createOrganization,
  };

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

// Hook pour récupérer uniquement l'ID de l'organisation courante (léger)
export function useCurrentOrganizationId() {
  const context = useContext(OrganizationContext);
  return context?.currentOrganizationId || null;
}

// Hook pour vérifier si le contexte est disponible
export function useOrganizationOptional() {
  return useContext(OrganizationContext);
}
