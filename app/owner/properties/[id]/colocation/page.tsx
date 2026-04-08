"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DoorOpen,
  Users,
  ScrollText,
  ClipboardList,
  Euro,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { ColocationDashboard } from "@/features/colocation/components/ColocationDashboard";
import { RulesEditor } from "@/features/colocation/components/RulesEditor";
import { TaskCalendar } from "@/features/colocation/components/TaskCalendar";
import { ExpensesList } from "@/features/colocation/components/ExpensesList";
import { RoomEditor } from "@/features/colocation/components/RoomEditor";
import { colocationMembersService } from "@/features/colocation/services/members.service";
import type { ColocationMemberWithDetails } from "@/features/colocation/types";
import Link from "next/link";

export default function OwnerColocationPage() {
  const params = useParams();
  const router = useRouter();
  const propertyId = params.id as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<any>(null);
  const [members, setMembers] = useState<ColocationMemberWithDetails[]>([]);
  const [showRoomEditor, setShowRoomEditor] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    loadProperty();
  }, [propertyId]);

  const loadProperty = async () => {
    try {
      const { data } = await supabase
        .from("properties")
        .select("id, type, adresse_complete, ville, code_postal, colocation_type, has_solidarity_clause, max_colocataires, loyer_base")
        .eq("id", propertyId)
        .single();

      setProperty(data);

      if (data) {
        const membersData = await colocationMembersService.getMembers(propertyId);
        setMembers(membersData);
      }
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <p className="text-muted-foreground">Bien non trouve</p>
      </div>
    );
  }

  const colocationTypeLabel =
    property.colocation_type === "bail_unique"
      ? "Bail unique (collectif)"
      : property.colocation_type === "baux_individuels"
        ? "Baux individuels"
        : "Colocation";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/owner/properties/${propertyId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Colocation</h1>
          <p className="text-muted-foreground">
            {property.adresse_complete}, {property.code_postal} {property.ville}
          </p>
        </div>
        <Button onClick={() => setShowRoomEditor(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter une chambre
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4" />
            Vue d&apos;ensemble
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Reglement
          </TabsTrigger>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Taches
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Euro className="h-4 w-4" />
            Depenses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <ColocationDashboard
            propertyId={propertyId}
            colocationTypeLabel={colocationTypeLabel}
            hasSolidarityClause={property.has_solidarity_clause || false}
          />
        </TabsContent>

        <TabsContent value="rules" className="mt-6">
          <RulesEditor propertyId={propertyId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <TaskCalendar propertyId={propertyId} />
        </TabsContent>

        <TabsContent value="expenses" className="mt-6">
          <ExpensesList
            propertyId={propertyId}
            members={members}
          />
        </TabsContent>
      </Tabs>

      {/* Room editor modal */}
      <RoomEditor
        propertyId={propertyId}
        open={showRoomEditor}
        onOpenChange={setShowRoomEditor}
        onSaved={loadProperty}
      />
    </div>
  );
}
