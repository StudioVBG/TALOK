"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { OwnerProfileForm } from "@/features/profiles/components/owner-profile-form";
import { ProfileGeneralForm } from "@/features/profiles/components/profile-general-form";
import { RestartTourCard } from "@/components/onboarding/RestartTourCard";

export default function OwnerProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Mon profil</h1>
          <p className="text-muted-foreground">Gérez vos informations personnelles</p>
        </div>

        <ProfileGeneralForm />
        <OwnerProfileForm />
        <RestartTourCard />
      </div>
    </ProtectedRoute>
  );
}

