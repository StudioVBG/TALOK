import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { FeatureStubPage } from "@/components/marketing/FeatureStubPage";

export const metadata: Metadata = {
  title: "Tickets & travaux locatifs | Talok",
  description:
    "Gérez les demandes de vos locataires et les travaux de vos biens. Devis, artisans, suivi, facturation — tout dans un seul outil.",
  robots: { index: false, follow: true },
  alternates: { canonical: "https://talok.fr/fonctionnalites/tickets-et-travaux" },
};

export default function TicketsEtTravauxPage() {
  return (
    <FeatureStubPage
      icon={Wrench}
      badgeLabel="Tickets & travaux"
      title="Les interventions,"
      highlight="pilotées de bout en bout"
      subtitle="Vos locataires déclarent leurs problèmes, vous choisissez un artisan, suivez les devis et les factures sans quitter Talok."
      bullets={[
        "Déclaration d’incident par le locataire avec photos",
        "Mise en relation avec un réseau d’artisans locaux",
        "Devis, bons d’intervention et facturation intégrés",
        "Suivi temps réel du statut de chaque ticket",
        "Rapports et historique par bien et par locataire",
      ]}
    />
  );
}
