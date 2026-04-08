"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Users } from "lucide-react";
import { colocationMembersService } from "@/features/colocation/services/members.service";
import { MemberCard } from "@/features/colocation/components/MemberCard";
import type { ColocationMemberWithDetails } from "@/features/colocation/types";
import Link from "next/link";

export default function ColocationMembersPage() {
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
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  const active = members.filter((m) => m.status === "active" || m.status === "departing");
  const departed = members.filter((m) => m.status === "departed");

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/owner/properties/${propertyId}/colocation`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6" />
          Colocataires
        </h1>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Actifs ({active.length})</TabsTrigger>
          <TabsTrigger value="history">Historique ({departed.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-6">
          {active.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun colocataire actif.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {active.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  propertyId={propertyId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          {departed.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun historique de departs.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {departed.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  propertyId={propertyId}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
