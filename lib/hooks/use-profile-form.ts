"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { useProfile } from "@/lib/hooks/use-profile";
import { apiClient } from "@/lib/api-client";
import { ownerProfilesService } from "@/features/profiles/services/owner-profiles.service";
import type { Profile, OwnerProfile, OwnerType } from "@/lib/types";

// ---------- Types ----------

/** Combined form data spanning both `profiles` and `owner_profiles` tables. */
export interface ProfileFormData {
  // profiles table
  prenom: string;
  nom: string;
  telephone: string;
  date_naissance: string;
  lieu_naissance: string;
  // owner_profiles table
  owner_type: OwnerType;
  iban: string;
  adresse_facturation: string;
}

export interface ProfileFormErrors {
  [key: string]: string | undefined;
}

export interface UseProfileFormReturn {
  formData: ProfileFormData;
  initialData: ProfileFormData | null;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  errors: ProfileFormErrors;
  updateField: <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => void;
  handleSave: () => Promise<void>;
  resetForm: () => void;
  /** Expose auth / profile data so the page component doesn't need useAuth separately. */
  profile: Profile | null;
  avatarUrl: string | null;
  userEmail: string | null;
}

// ---------- Helpers ----------

function getDefaultFormData(): ProfileFormData {
  return {
    prenom: "",
    nom: "",
    telephone: "",
    date_naissance: "",
    lieu_naissance: "",
    owner_type: "particulier",
    iban: "",
    adresse_facturation: "",
  };
}

function mapToFormData(
  profile: Profile | null,
  ownerProfile: OwnerProfile | null
): ProfileFormData {
  return {
    prenom: profile?.prenom ?? "",
    nom: profile?.nom ?? "",
    telephone: profile?.telephone ?? "",
    date_naissance: profile?.date_naissance ?? "",
    lieu_naissance: (profile as unknown as Record<string, unknown>)?.lieu_naissance as string ?? "",
    owner_type: ownerProfile?.type ?? "particulier",
    iban: ownerProfile?.iban ?? "",
    adresse_facturation: ownerProfile?.adresse_facturation ?? "",
  };
}

/** Validate SIRET using Luhn algorithm. */
export function validateSiret(siret: string): boolean {
  const digits = siret.replace(/\D/g, "");
  if (digits.length !== 14) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

// ---------- Hook ----------

export function useProfileForm(): UseProfileFormReturn {
  const router = useRouter();
  const { toast } = useToast();
  const { user, profile: authProfile, refreshProfile } = useAuth();
  const { ownerProfile, loading: profileLoading } = useProfile();

  const [initialData, setInitialData] = useState<ProfileFormData | null>(null);
  const [formData, setFormData] = useState<ProfileFormData>(getDefaultFormData());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<ProfileFormErrors>({});

  // Sync initial data from hooks
  useEffect(() => {
    if (profileLoading) return;

    const mapped = mapToFormData(
      authProfile as Profile | null,
      ownerProfile
    );
    setFormData(mapped);
    setInitialData(mapped);
    setIsLoading(false);
  }, [authProfile, ownerProfile, profileLoading]);

  // Dirty detection
  const isDirty =
    initialData !== null &&
    JSON.stringify(formData) !== JSON.stringify(initialData);

  // Field update
  const updateField = useCallback(
    <K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
      setFormData((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    []
  );

  // Validation
  const validate = useCallback((): boolean => {
    const newErrors: ProfileFormErrors = {};

    if (!formData.prenom.trim()) {
      newErrors.prenom = "Le prénom est obligatoire";
    }
    if (!formData.nom.trim()) {
      newErrors.nom = "Le nom est obligatoire";
    }

    // IBAN basic format check (if provided)
    if (formData.iban.trim()) {
      const cleanIban = formData.iban.replace(/\s/g, "").toUpperCase();
      if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{4,}$/.test(cleanIban)) {
        newErrors.iban = "Format IBAN invalide";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  // Unified save
  const handleSave = useCallback(async () => {
    if (!validate()) {
      toast({
        title: "Erreur de validation",
        description: "Veuillez corriger les erreurs avant de sauvegarder.",
        variant: "destructive",
      });
      return;
    }

    if (!initialData) return;

    setIsSaving(true);

    try {
      // 1. Build profile update payload (only changed fields)
      const profilePayload: Record<string, string | null> = {};
      if (formData.prenom !== initialData.prenom) {
        profilePayload.prenom = formData.prenom || null;
      }
      if (formData.nom !== initialData.nom) {
        profilePayload.nom = formData.nom || null;
      }
      if ((formData.telephone || null) !== (initialData.telephone || null)) {
        profilePayload.telephone = formData.telephone || null;
      }
      if ((formData.date_naissance || null) !== (initialData.date_naissance || null)) {
        profilePayload.date_naissance = formData.date_naissance || null;
      }
      if ((formData.lieu_naissance || null) !== (initialData.lieu_naissance || null)) {
        profilePayload.lieu_naissance = formData.lieu_naissance || null;
      }

      // 2. Build owner profile payload (entity fields now managed via /owner/entities)
      const ownerPayload = {
        type: formData.owner_type,
        iban: formData.iban.replace(/\s/g, "") || null,
        adresse_facturation: formData.adresse_facturation || null,
      };

      // 3. Execute both saves
      const promises: Promise<unknown>[] = [];

      if (Object.keys(profilePayload).length > 0) {
        promises.push(apiClient.patch<Profile>("/me/profile", profilePayload));
      }

      // Always save owner profile to handle type changes
      const profile = authProfile as Profile | null;
      if (profile) {
        promises.push(
          ownerProfilesService.createOrUpdateOwnerProfile(profile.id, ownerPayload)
        );
      }

      await Promise.all(promises);

      // Update initial data to match saved state
      setInitialData({ ...formData });

      toast({
        title: "Profil enregistré",
        description: "Toutes vos informations ont été sauvegardées.",
      });

      await refreshProfile();
      router.refresh();
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description:
          error instanceof Error
            ? error.message
            : "Impossible de sauvegarder le profil.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }, [formData, initialData, authProfile, validate, toast, refreshProfile, router]);

  // Reset
  const resetForm = useCallback(() => {
    if (initialData) {
      setFormData(initialData);
      setErrors({});
    }
  }, [initialData]);

  return {
    formData,
    initialData,
    isDirty,
    isLoading,
    isSaving,
    errors,
    updateField,
    handleSave,
    resetForm,
    profile: (authProfile as Profile) ?? null,
    avatarUrl: (authProfile as Profile)?.avatar_url ?? null,
    userEmail: user?.email ?? null,
  };
}
