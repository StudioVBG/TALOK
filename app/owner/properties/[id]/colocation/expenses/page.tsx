"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { ExpensesList } from "@/features/colocation/components/ExpensesList";
import { colocationMembersService } from "@/features/colocation/services/members.service";
import type { ColocationMemberWithDetails } from "@/features/colocation/types";
import Link from "next/link";

export default function ColocationExpensesPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const [members, setMembers] = useState<ColocationMemberWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, [propertyId]);

  const loadMembers = async () => {
    try {
      const data = await colocationMembersService.getMembers(propertyId);
      setMembers(data);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/owner/properties/${propertyId}/colocation`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Depenses partagees</h1>
      </div>

      <ExpensesList propertyId={propertyId} members={members} />
    </div>
  );
}
