"use client";
// @ts-nocheck

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/hooks/use-auth";
import { peopleService } from "@/features/admin/services/people.service";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Phone, MapPin, ShieldCheck, XCircle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface VendorDetail {
  id: string;
  full_name: string;
  prenom?: string | null;
  nom?: string | null;
  email?: string | null;
  telephone?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  profile: {
    status?: string;
    validated_at?: string | null;
    validated_by?: string | null;
    rejection_reason?: string | null;
    type_services: string[];
    certifications?: string | null;
    zones_intervention?: string | null;
  } | null;
}

function VendorDetailContent({ vendorId }: { vendorId: string }) {
  const { toast } = useToast();
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorDetail | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user || profile?.role !== "admin") {
      router.replace("/admin/people");
      return;
    }
    void fetchVendor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, authLoading, vendorId]);

  const fetchVendor = async () => {
    setLoading(true);
    try {
      const data = await peopleService.getVendor(vendorId);
      setVendor(data);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de charger le prestataire.",
        variant: "destructive",
      });
      router.replace("/admin/people");
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!vendor?.profile?.status) {
      return <Badge variant="outline">Statut inconnu</Badge>;
    }

    switch (vendor.profile.status) {
      case "approved":
        return (
          <Badge variant="default" className="bg-green-500 hover:bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Approuvé
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="secondary" className="bg-amber-200 text-amber-900 hover:bg-amber-200">
            <ShieldCheck className="h-3 w-3 mr-1" />
            En attente
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejeté
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="capitalize">
            {vendor.profile.status}
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Chargement du prestataire…</p>
        </div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        Prestataire introuvable.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/people">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold">{vendor.full_name}</h1>
          <p className="text-muted-foreground">Détails du prestataire</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Informations générales</CardTitle>
              <CardDescription>Coordonnées principales</CardDescription>
            </div>
            {getStatusBadge()}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {vendor.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{vendor.email}</span>
              </div>
            )}
            {vendor.telephone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{vendor.telephone}</span>
              </div>
            )}
            {vendor.profile?.zones_intervention && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                <span>{vendor.profile.zones_intervention}</span>
              </div>
            )}
            {vendor.profile?.certifications && (
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-muted-foreground mt-1" />
                <span>{vendor.profile.certifications}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services proposés</CardTitle>
            <CardDescription>Liste déclarée par le prestataire</CardDescription>
          </CardHeader>
          <CardContent>
            {vendor.profile?.type_services?.length ? (
              <div className="flex flex-wrap gap-2">
                {vendor.profile.type_services.map((service) => (
                  <Badge key={service} variant="secondary" className="capitalize">
                    {service}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Aucun service renseigné.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {vendor.profile?.status === "rejected" && vendor.profile.rejection_reason && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive">Raison du rejet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{vendor.profile.rejection_reason}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function VendorDetailPage({ params }: { params: { id: string } }) {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <VendorDetailContent vendorId={params.id} />
    </ProtectedRoute>
  );
}





