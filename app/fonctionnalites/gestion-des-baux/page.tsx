import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { FeatureStubPage } from "@/components/marketing/FeatureStubPage";

export const metadata: Metadata = {
  title: "Gestion des baux locatifs | Talok",
  description:
    "Créez, signez et gérez vos baux ALUR/ELAN en quelques minutes. Signature électronique, renouvellement automatique, révision IRL.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://talok.fr/fonctionnalites/gestion-des-baux" },
};

export default function GestionDesBauxPage() {
  return (
    <FeatureStubPage
      icon={FileText}
      badgeLabel="Gestion des baux"
      title="Des baux conformes,"
      highlight="signés en 5 minutes"
      subtitle="Modèles ALUR/ELAN toujours à jour avec la loi. Signature électronique à valeur légale. Renouvellement et révision IRL automatiques."
      bullets={[
        "Modèles meublé, non-meublé, colocation, bail mobilité",
        "Signature électronique à valeur légale (même valeur qu’un original papier)",
        "Révision IRL automatique chaque année",
        "Renouvellements, avenants et résiliations assistés",
        "Clauses personnalisables et bibliothèque juridique",
      ]}
    />
  );
}
