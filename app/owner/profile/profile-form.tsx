"use client";

import { useState } from "react";
import { User, Building2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileForm } from "@/lib/hooks/use-profile-form";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
import { ProfileCompletion } from "@/components/profile/profile-completion";
import { ProfileIdentityTab } from "@/components/profile/ProfileIdentityTab";
import { ProfileEntitiesTab } from "@/components/profile/ProfileEntitiesTab";
import { ProfileSecurityTab } from "@/components/profile/ProfileSecurityTab";

type ProfileTab = "identity" | "entities" | "security";

const TABS: Array<{ id: ProfileTab; label: string; icon: typeof User }> = [
  { id: "identity", label: "Identité", icon: User },
  { id: "entities", label: "Entités", icon: Building2 },
  { id: "security", label: "Sécurité", icon: Shield },
];

export function ProfileForm() {
  const {
    formData,
    isDirty,
    isLoading,
    isSaving,
    errors,
    updateField,
    handleSave,
    resetForm,
    profile,
    avatarUrl,
    userEmail,
  } = useProfileForm();

  useUnsavedChangesWarning(isDirty);

  const [activeTab, setActiveTab] = useState<ProfileTab>("identity");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with completion indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Mon profil</h1>
          <p className="text-muted-foreground">
            Gérez vos informations personnelles
          </p>
        </div>
        <ProfileCompletion data={formData} />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "identity" && (
          <>
            {/* Required fields note */}
            <p className="text-sm text-muted-foreground mb-6">
              Les champs marqués d&apos;un{" "}
              <span className="text-destructive">*</span> sont obligatoires.
            </p>
            <ProfileIdentityTab
              formData={formData}
              errors={errors}
              isSaving={isSaving}
              profile={profile}
              avatarUrl={avatarUrl}
              userEmail={userEmail}
              updateField={updateField}
              onSwitchToEntities={() => setActiveTab("entities")}
            />
          </>
        )}
        {activeTab === "entities" && <ProfileEntitiesTab />}
        {activeTab === "security" && <ProfileSecurityTab />}
      </div>

      {/* Unified save button — only for identity tab */}
      {activeTab === "identity" && (
        <div className="flex justify-end gap-3 pt-2 sticky bottom-4 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 py-3 px-4 -mx-4 rounded-lg border shadow-sm">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={isSaving}
            >
              Annuler les modifications
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            loading={isSaving}
            loadingText="Enregistrement..."
            className="min-w-[220px]"
          >
            Enregistrer les modifications
          </Button>
        </div>
      )}
    </div>
  );
}
