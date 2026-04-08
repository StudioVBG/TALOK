"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Euro, CreditCard, DoorOpen, Calendar } from "lucide-react";
import { colocationMembersService } from "@/features/colocation/services/members.service";
import { colocationRoomsService } from "@/features/colocation/services/rooms.service";
import { ColocationPaymentSplit } from "@/features/colocation/components/ColocationPaymentSplit";
import type { ColocationMemberWithDetails, ColocationRoomWithOccupant } from "@/features/colocation/types";

export default function TenantColocationPaymentPage() {
  const [loading, setLoading] = useState(true);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [myMember, setMyMember] = useState<ColocationMemberWithDetails | null>(null);
  const [rooms, setRooms] = useState<ColocationRoomWithOccupant[]>([]);
  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!profile) return;

      const { data: signer } = await supabase
        .from("lease_signers")
        .select("leases!inner(property_id)")
        .eq("profiles.user_id", user.id)
        .in("role", ["locataire_principal", "colocataire"])
        .limit(1)
        .single();

      if (signer) {
        const lease = signer.leases as any;
        if (lease?.property_id) {
          setPropertyId(lease.property_id);

          const [membersData, roomsData] = await Promise.all([
            colocationMembersService.getMembers(lease.property_id),
            colocationRoomsService.getRooms(lease.property_id),
          ]);

          const member = membersData.find((m) => m.tenant_profile_id === profile.id);
          if (member) setMyMember(member);
          setRooms(roomsData);
        }
      }
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!propertyId || !myMember) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl text-center">
        <p className="text-muted-foreground">Aucune colocation active trouvee.</p>
      </div>
    );
  }

  const totalRentCents = rooms.reduce((acc, r) => acc + r.rent_share_cents, 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold">Payer ma part</h1>

      {/* My payment info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Ma part de loyer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold text-primary">
                {(myMember.rent_share_cents / 100).toFixed(0)}€
              </p>
              <p className="text-sm text-muted-foreground mt-1">Loyer mensuel</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold">
                {(myMember.charges_share_cents / 100).toFixed(0)}€
              </p>
              <p className="text-sm text-muted-foreground mt-1">Charges</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/10">
              <p className="text-3xl font-bold text-primary">
                {((myMember.rent_share_cents + myMember.charges_share_cents) / 100).toFixed(0)}€
              </p>
              <p className="text-sm text-muted-foreground mt-1">Total mensuel</p>
            </div>
          </div>

          {myMember.room && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <DoorOpen className="h-4 w-4" />
              {myMember.room.room_number}
              {myMember.room.room_label && ` - ${myMember.room.room_label}`}
            </div>
          )}

          {myMember.pays_individually && (
            <Badge className="mt-3 bg-blue-100 text-blue-700">
              Paiement individuel SEPA
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Payment split visualization */}
      <ColocationPaymentSplit rooms={rooms} totalRentCents={totalRentCents} />
    </div>
  );
}
