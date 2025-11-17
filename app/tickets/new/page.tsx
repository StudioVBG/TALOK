"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { TicketForm } from "@/features/tickets/components/ticket-form";
import { useRouter, useSearchParams } from "next/navigation";
import { canManageTickets } from "@/lib/helpers/permissions";
import { useAuth } from "@/lib/hooks/use-auth";
import { useEffect } from "react";

function NewTicketPageContent() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("propertyId");

  useEffect(() => {
    if (profile && !canManageTickets(profile.role as any)) {
      router.push("/dashboard");
    }
  }, [profile, router]);

  if (!profile || !canManageTickets(profile.role as any)) {
    return null;
  }

  const handleSuccess = () => {
    if (propertyId) {
      router.push(`/properties/${propertyId}`);
    } else {
      router.push("/tickets");
    }
  };

  const handleCancel = () => {
    if (propertyId) {
      router.push(`/properties/${propertyId}`);
    } else {
      router.push("/tickets");
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <TicketForm propertyId={propertyId || undefined} onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}

export default function NewTicketPage() {
  return (
    <ProtectedRoute>
      <NewTicketPageContent />
    </ProtectedRoute>
  );
}

