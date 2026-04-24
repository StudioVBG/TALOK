import type { Metadata } from "next";
import { Landmark } from "lucide-react";
import { FeatureStubPage } from "@/components/marketing/FeatureStubPage";

export const metadata: Metadata = {
  title: "Solution pour syndics de copropriété | Talok",
  description:
    "Logiciel de syndic complet : copropriétés, AG, comptabilité, appels de fonds, extranet copropriétaires. Adapté métropole et DROM-COM.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://talok.fr/solutions/syndics" },
};

export default function SyndicsPage() {
  return (
    <FeatureStubPage
      icon={Landmark}
      badgeLabel="Solution syndics"
      title="Un outil complet"
      highlight="pour les syndics"
      subtitle="Copropriétés professionnelles ou bénévoles : pilotez vos immeubles, vos AG et votre comptabilité syndic dans une seule plateforme."
      bullets={[
        "Gestion multi-copropriétés avec extranet dédié",
        "Assemblées générales : convocation, vote en ligne, PV",
        "Appels de fonds, budgets, charges et régularisation annuelle",
        "Comptabilité conforme au plan comptable des copropriétés",
        "Bridge avec les modules locatif et travaux de Talok",
      ]}
    />
  );
}
