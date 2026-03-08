"use client";

import Link from "next/link";
import { Wrench, Hammer } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TicketsTabNavProps {
  activeTab: "tickets" | "travaux";
}

/**
 * SOTA 2026 — Navigation unifiée Tickets & Ordres de travaux
 * Utilisé dans les pages tickets et work-orders pour une navigation cohérente.
 */
export function TicketsTabNav({ activeTab }: TicketsTabNavProps) {
  return (
    <Tabs value={activeTab}>
      <TabsList className="grid w-full grid-cols-2 max-w-xs">
        <TabsTrigger value="tickets" className="gap-1.5 text-xs sm:text-sm" asChild>
          <Link href="/owner/tickets">
            <Wrench className="h-4 w-4" />
            Tickets
          </Link>
        </TabsTrigger>
        <TabsTrigger value="travaux" className="gap-1.5 text-xs sm:text-sm" asChild>
          <Link href="/owner/work-orders">
            <Hammer className="h-4 w-4" />
            Travaux
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
