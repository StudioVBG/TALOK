"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { ProfileForm } from "./profile-form";
import { RestartTourCard } from "@/components/onboarding/RestartTourCard";

export default function OwnerProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <div className="space-y-6">
        <ProfileForm />
        <RestartTourCard />
      </div>
    </ProtectedRoute>
  );
}
