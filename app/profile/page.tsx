"use client";
// @ts-nocheck

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { OwnerProfileForm } from "@/features/profiles/components/owner-profile-form";
import { TenantProfileForm } from "@/features/profiles/components/tenant-profile-form";
import { ProviderProfileForm } from "@/features/profiles/components/provider-profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useProfile } from "@/lib/hooks/use-profile";
import { useAuth } from "@/lib/hooks/use-auth";
import { ProfileGeneralForm } from "@/features/profiles/components/profile-general-form";

function ProfilePageContent() {
  const router = useRouter();
  const { profile } = useAuth();
  const { profile: profileData } = useProfile();

  // Rediriger les owners vers leur page profil dédiée
  useEffect(() => {
    if (profile?.role === "owner") {
      router.replace("/app/owner/profile");
    }
  }, [profile, router]);

  // Si owner, afficher un loader pendant la redirection
  if (profile?.role === "owner") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Redirection en cours...</p>
        </div>
      </div>
    );
  }

  const renderProfileForm = () => {
    if (!profileData || profile?.role === "owner") return null;

    switch (profileData.role) {
      case "tenant":
        return <TenantProfileForm />;
      case "provider":
        return <ProviderProfileForm />;
      default:
        return (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                Aucun formulaire de profil spécialisé disponible pour votre rôle.
              </p>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mon profil</h1>
        <p className="text-muted-foreground">Gérez vos informations personnelles</p>
      </div>

      <ProfileGeneralForm />

      {renderProfileForm()}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <ProfilePageContent />
    </ProtectedRoute>
  );
}

