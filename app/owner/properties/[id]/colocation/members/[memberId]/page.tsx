"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Calendar,
  DoorOpen,
  Euro,
  LogOut,
  Mail,
  Phone,
  UserPlus,
} from "lucide-react";
import { colocationMembersService } from "@/features/colocation/services/members.service";
import { DepartureModal } from "@/features/colocation/components/DepartureModal";
import { SolidarityBadge } from "@/features/colocation/components/SolidarityBadge";
import { MEMBER_STATUS_LABELS } from "@/features/colocation/types";
import type { ColocationMemberWithDetails } from "@/features/colocation/types";
import Link from "next/link";

export default function MemberDetailPage() {
  const params = useParams();
  const propertyId = params.id as string;
  const memberId = params.memberId as string;

  const [member, setMember] = useState<ColocationMemberWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeparture, setShowDeparture] = useState(false);

  useEffect(() => {
    loadMember();
  }, [memberId]);

  const loadMember = async () => {
    try {
      const members = await colocationMembersService.getMembers(propertyId);
      const found = members.find((m) => m.id === memberId) || null;
      setMember(found);
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

  if (!member) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <p className="text-muted-foreground">Membre non trouve</p>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    departing: "bg-orange-100 text-orange-700",
    departed: "bg-gray-100 text-gray-500",
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/owner/properties/${propertyId}/colocation/members`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              {member.profile?.avatar_url && (
                <AvatarImage src={member.profile.avatar_url} />
              )}
              <AvatarFallback>
                {(member.profile?.prenom?.[0] || "")}{(member.profile?.nom?.[0] || "")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">
                {member.profile?.prenom} {member.profile?.nom}
              </h1>
              <Badge className={statusColors[member.status]}>
                {MEMBER_STATUS_LABELS[member.status]}
              </Badge>
            </div>
          </div>
        </div>
        {member.status === "active" && (
          <Button variant="outline" onClick={() => setShowDeparture(true)}>
            <LogOut className="h-4 w-4 mr-2" />
            Declarer un depart
          </Button>
        )}
      </div>

      {member.solidarity_end_date && (member.status === "departing" || member.status === "departed") && (
        <SolidarityBadge endDate={member.solidarity_end_date} />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Coordonnees</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {member.profile?.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {member.profile.email}
              </div>
            )}
            {member.profile?.telephone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {member.profile.telephone}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Informations bail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <DoorOpen className="h-4 w-4" /> Chambre
              </span>
              <span className="font-medium">
                {member.room?.room_number || "Non attribuee"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4" /> Loyer
              </span>
              <span className="font-medium">
                {(member.rent_share_cents / 100).toFixed(0)}€/mois
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4" /> Charges
              </span>
              <span className="font-medium">
                {(member.charges_share_cents / 100).toFixed(0)}€/mois
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Euro className="h-4 w-4" /> Depot de garantie
              </span>
              <span className="font-medium">
                {(member.deposit_cents / 100).toFixed(0)}€
                {member.deposit_returned && " (restitue)"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Entree
              </span>
              <span className="font-medium">
                {new Date(member.move_in_date).toLocaleDateString("fr-FR")}
              </span>
            </div>
            {member.move_out_date && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Sortie
                </span>
                <span className="font-medium">
                  {new Date(member.move_out_date).toLocaleDateString("fr-FR")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {member.replaced_by_member_id && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <UserPlus className="h-4 w-4" />
              Un remplacant a ete nomme - la solidarite est eteinte.
            </div>
          </CardContent>
        </Card>
      )}

      {showDeparture && (
        <DepartureModal
          member={member}
          open={showDeparture}
          onOpenChange={setShowDeparture}
          onSaved={loadMember}
        />
      )}
    </div>
  );
}
