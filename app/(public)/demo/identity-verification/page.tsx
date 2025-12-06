"use client";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { IdentityVerificationFlow } from "@/features/identity-verification";

/**
 * Page de démonstration du flux de vérification d'identité
 * Route publique pour tester l'UI sans authentification
 */
export default function IdentityVerificationDemoPage() {
  const router = useRouter();
  const { toast } = useToast();

  const handleSuccess = (data: any) => {
    toast({
      title: "Démo : Vérification réussie !",
      description: `Données extraites : ${JSON.stringify(data)}`,
    });
    // En démo, revenir à l'écran d'intro après 3 secondes
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  };

  const handleSkip = () => {
    toast({
      title: "Démo : Vérification reportée",
      description: "L'utilisateur a choisi de reporter la vérification.",
    });
    router.push("/");
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950">
      <IdentityVerificationFlow
        onSuccess={handleSuccess}
        onSkip={handleSkip}
        showSkipButton={true}
      />
    </div>
  );
}

