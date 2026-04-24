import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { FeatureStubPage } from "@/components/marketing/FeatureStubPage";

export const metadata: Metadata = {
  title: "Immeuble & copropriété | Talok",
  description:
    "Gérez votre immeuble, vos lots et votre copropriété. Appels de fonds, assemblées générales, comptabilité syndic — intégré à Talok.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://talok.fr/fonctionnalites/immeuble-copropriete" },
};

export default function ImmeubleCoproprietePage() {
  return (
    <FeatureStubPage
      icon={Building2}
      badgeLabel="Immeuble & copropriété"
      title="Immeubles et copropriétés,"
      highlight="gérés simplement"
      subtitle="Organisez vos lots, vos copropriétaires et vos AG. Appels de fonds, charges, PV d’assemblée — tout est intégré."
      bullets={[
        "Gestion des lots, tantièmes et copropriétaires",
        "Assemblées générales : convocation, vote, PV automatique",
        "Appels de fonds et suivi des budgets prévisionnels",
        "Comptabilité copropriété conforme au plan comptable syndic",
        "Extranet dédié pour chaque copropriétaire",
      ]}
    />
  );
}
