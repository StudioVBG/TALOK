"use client";
// @ts-nocheck

import { ProtectedRoute } from "@/components/protected-route";
import { TicketsList } from "@/features/tickets/components/tickets-list";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/hooks/use-auth";

export default function TicketsPage() {
  const { profile } = useAuth();

  return (
    <ProtectedRoute>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Mes tickets</h1>
            <p className="text-muted-foreground">Gérez vos demandes de maintenance</p>
          </div>
          {(profile?.role === "tenant" || profile?.role === "owner") && (
            <Link href="/tickets/new">
              <Button>Créer un ticket</Button>
            </Link>
          )}
        </div>

        <TicketsList />
      </div>
    </ProtectedRoute>
  );
}

