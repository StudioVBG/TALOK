"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { ProfileForm } from "./profile-form";

export default function OwnerProfilePage() {
  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <ProfileForm />
    </ProtectedRoute>
  );
}
