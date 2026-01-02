"use client";
// @ts-nocheck

/**
 * Page de création d'un nouveau bail de parking
 * UI/UX SOTA 2025
 */

import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/protected-route";
import { ParkingLeaseWizard } from "@/features/leases/components/parking-lease-wizard";
import type { ParkingLease } from "@/lib/templates/bail/bail-parking.types";
import { useToast } from "@/components/ui/use-toast";

export default function NewParkingLeasePage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleComplete = async (lease: Partial<ParkingLease>) => {
    try {
      // TODO: Sauvegarder le bail en base de données
      console.log("Bail parking créé:", lease);
      
      toast({
        title: "Contrat créé ! 🎉",
        description: "Votre contrat de location de parking a été généré avec succès.",
      });
      
      // Rediriger vers la liste des baux
      router.push("/owner/leases");
    } catch (error) {
      console.error("Erreur création bail:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le contrat.",
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    router.push("/owner/leases");
  };

  return (
    <ProtectedRoute allowedRoles={["owner"]}>
      <div className="min-h-screen">
        <ParkingLeaseWizard 
          onComplete={handleComplete}
          onCancel={handleCancel}
        />
      </div>
    </ProtectedRoute>
  );
}

