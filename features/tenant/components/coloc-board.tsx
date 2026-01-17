"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { roommatesService, Roommate } from "../services/roommates.service";
import { paymentSharesService, PaymentSharePublic } from "../services/payment-shares.service";
import { CheckCircle2, Clock, XCircle, Users, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ColocBoardProps {
  leaseId: string;
  month: string; // Format: YYYY-MM-01
}

export function ColocBoard({ leaseId, month }: ColocBoardProps) {
  const { toast } = useToast();
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, PaymentSharePublic>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [leaseId, month]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [roommatesData, paymentData] = await Promise.all([
        roommatesService.getRoommates(leaseId),
        paymentSharesService.getPaymentShares(leaseId, month),
      ]);

      setRoommates(roommatesData);

      // Créer un map des statuts de paiement
      const statusMap: Record<string, PaymentSharePublic> = {};
      paymentData.others.forEach((share) => {
        statusMap[share.roommate_id] = share;
      });
      setPaymentStatuses(statusMap);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: "Erreur lors du chargement",
        variant: "destructive",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "pending":
      case "scheduled":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "unpaid":
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "paid":
        return "Payé";
      case "pending":
        return "En attente";
      case "scheduled":
        return "Programmé";
      case "unpaid":
        return "Non payé";
      case "failed":
        return "Échoué";
      default:
        return "N/A";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Colocataires</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (roommates.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Colocataires</CardTitle>
          <CardDescription>Aucun colocataire</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <CardTitle>Colocataires</CardTitle>
        </div>
        <CardDescription>
          {new Date(month).toLocaleDateString("fr-FR", {
            month: "long",
            year: "numeric",
          })}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {roommates.map((roommate) => {
            const paymentStatus = paymentStatuses[roommate.id];
            const initials = `${roommate.first_name[0]}${roommate.last_name[0]}`.toUpperCase();

            return (
              <div
                key={roommate.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={undefined} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {roommate.first_name} {roommate.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {roommate.role === "principal"
                        ? "Locataire principal"
                        : roommate.role === "tenant"
                        ? "Colocataire"
                        : roommate.role}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {paymentStatus && (
                    <>
                      {getStatusIcon(paymentStatus.status)}
                      <Badge variant="outline">
                        {getStatusLabel(paymentStatus.status)}
                      </Badge>
                    </>
                  )}
                  {paymentStatus?.autopay && (
                    <Badge variant="secondary" className="text-xs">
                      Autopay
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

