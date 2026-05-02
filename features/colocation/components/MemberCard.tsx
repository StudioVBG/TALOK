"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildAvatarUrl } from "@/lib/helpers/format";
import { Euro, DoorOpen, Calendar, Shield } from "lucide-react";
import type { ColocationMemberWithDetails } from "../types";
import { MEMBER_STATUS_LABELS } from "../types";
import Link from "next/link";

interface MemberCardProps {
  member: ColocationMemberWithDetails;
  propertyId: string;
}

export function MemberCard({ member, propertyId }: MemberCardProps) {
  const rentEuros = (member.rent_share_cents / 100).toFixed(0);
  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-700",
    pending: "bg-yellow-100 text-yellow-700",
    departing: "bg-orange-100 text-orange-700",
    departed: "bg-gray-100 text-gray-500",
  };

  return (
    <Link href={`/owner/properties/${propertyId}/colocation/members/${member.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10">
              {member.profile?.avatar_url && (
                <AvatarImage src={buildAvatarUrl(member.profile.avatar_url) ?? undefined} />
              )}
              <AvatarFallback>
                {(member.profile?.prenom?.[0] || "")}{(member.profile?.nom?.[0] || "")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="font-medium truncate">
                  {member.profile?.prenom} {member.profile?.nom}
                </p>
                <Badge className={`text-xs ${statusColors[member.status] || ""}`}>
                  {MEMBER_STATUS_LABELS[member.status]}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Euro className="h-3.5 w-3.5" />
                  {rentEuros}€/mois
                </span>
                {member.room && (
                  <span className="flex items-center gap-1">
                    <DoorOpen className="h-3.5 w-3.5" />
                    {member.room.room_number}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(member.move_in_date).toLocaleDateString("fr-FR")}
                </span>
              </div>

              {member.solidarity_end_date && member.status === "departing" && (
                <SolidarityBadge endDate={member.solidarity_end_date} />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function SolidarityBadge({ endDate }: { endDate: string }) {
  const date = new Date(endDate);
  const isExpired = date < new Date();

  return (
    <div className={`flex items-center gap-1 mt-2 text-xs ${isExpired ? "text-gray-500" : "text-amber-600"}`}>
      <Shield className="h-3.5 w-3.5" />
      {isExpired
        ? `Solidarite expiree le ${date.toLocaleDateString("fr-FR")}`
        : `Solidaire jusqu'au ${date.toLocaleDateString("fr-FR")}`}
    </div>
  );
}
