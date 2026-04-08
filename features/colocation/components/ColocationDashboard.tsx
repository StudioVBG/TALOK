"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Home,
  Users,
  DoorOpen,
  Euro,
  ClipboardList,
  AlertTriangle,
} from "lucide-react";
import { colocationRoomsService } from "../services/rooms.service";
import { colocationMembersService } from "../services/members.service";
import { colocationExpensesService } from "../services/expenses.service";
import { colocationTasksService } from "../services/tasks.service";
import type { ColocationRoomWithOccupant, ColocationMemberWithDetails } from "../types";
import type { ColocationTaskRow, ColocationExpenseRow } from "@/lib/supabase/database.types";
import { RoomCard } from "./RoomCard";
import { MemberCard } from "./MemberCard";

interface ColocationDashboardProps {
  propertyId: string;
  colocationTypeLabel: string;
  hasSolidarityClause: boolean;
}

export function ColocationDashboard({
  propertyId,
  colocationTypeLabel,
  hasSolidarityClause,
}: ColocationDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<ColocationRoomWithOccupant[]>([]);
  const [members, setMembers] = useState<ColocationMemberWithDetails[]>([]);
  const [tasks, setTasks] = useState<ColocationTaskRow[]>([]);
  const [expenses, setExpenses] = useState<ColocationExpenseRow[]>([]);

  useEffect(() => {
    loadData();
  }, [propertyId]);

  const loadData = async () => {
    try {
      const [roomsData, membersData, tasksData, expensesData] = await Promise.all([
        colocationRoomsService.getRooms(propertyId),
        colocationMembersService.getMembers(propertyId),
        colocationTasksService.getTasks(propertyId),
        colocationExpensesService.getExpenses(propertyId),
      ]);
      setRooms(roomsData);
      setMembers(membersData);
      setTasks(tasksData);
      setExpenses(expensesData);
    } catch (err) {
      console.error("Erreur chargement colocation:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");
  const departingMembers = members.filter((m) => m.status === "departing");
  const occupiedRooms = rooms.filter((r) => !r.is_available);
  const availableRooms = rooms.filter((r) => r.is_available);
  const pendingTasks = tasks.filter((t) => !t.completed_at);
  const unsettledExpenses = expenses.filter((e) => !e.is_settled);
  const totalUnsettledCents = unsettledExpenses.reduce(
    (acc, e) => acc + e.amount_cents,
    0
  );

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <DoorOpen className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {occupiedRooms.length}/{rooms.length}
                </p>
                <p className="text-sm text-muted-foreground">Chambres occupees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <Users className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeMembers.length}</p>
                <p className="text-sm text-muted-foreground">Colocataires actifs</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-50">
                <ClipboardList className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingTasks.length}</p>
                <p className="text-sm text-muted-foreground">Taches en attente</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50">
                <Euro className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {(totalUnsettledCents / 100).toFixed(0)}€
                </p>
                <p className="text-sm text-muted-foreground">Depenses non reglees</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Colocation info badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="text-sm">
          {colocationTypeLabel}
        </Badge>
        {hasSolidarityClause && (
          <Badge variant="secondary" className="text-sm">
            Clause de solidarite
          </Badge>
        )}
        {availableRooms.length > 0 && (
          <Badge className="text-sm bg-green-100 text-green-700 hover:bg-green-100">
            {availableRooms.length} chambre{availableRooms.length > 1 ? "s" : ""} disponible{availableRooms.length > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {/* Departing members alert */}
      {departingMembers.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">
                  {departingMembers.length} depart{departingMembers.length > 1 ? "s" : ""} en cours
                </p>
                {departingMembers.map((m) => (
                  <p key={m.id} className="text-sm text-amber-700 mt-1">
                    {m.profile?.prenom} {m.profile?.nom} - Depart prevu le{" "}
                    {m.move_out_date
                      ? new Date(m.move_out_date).toLocaleDateString("fr-FR")
                      : "non defini"}
                    {m.solidarity_end_date && (
                      <span className="ml-2 text-amber-600">
                        (Solidarite jusqu'au{" "}
                        {new Date(m.solidarity_end_date).toLocaleDateString("fr-FR")})
                      </span>
                    )}
                  </p>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rooms grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5" />
            Chambres ({rooms.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rooms.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune chambre configuree. Ajoutez des chambres pour commencer.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {rooms.map((room) => (
                <RoomCard key={room.id} room={room} propertyId={propertyId} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Colocataires ({activeMembers.length} actifs)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeMembers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucun colocataire pour le moment.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeMembers.map((member) => (
                <MemberCard
                  key={member.id}
                  member={member}
                  propertyId={propertyId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
