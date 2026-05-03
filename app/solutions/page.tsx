import type { Metadata } from "next";
import { SolutionsIndexClient } from "./SolutionsIndexClient";

export const metadata: Metadata = {
  title: "Solutions Talok — Une plateforme pour 7 rôles",
  description:
    "Propriétaires, investisseurs, agences, syndics, locataires, prestataires, garants : Talok adapte ses outils à chaque profil. Découvrez la solution qui vous correspond.",
  alternates: { canonical: "https://talok.fr/solutions" },
  openGraph: {
    title: "Solutions Talok — Une plateforme pour 7 rôles",
    description:
      "Une plateforme de gestion locative qui parle la langue de chacun : bailleur, locataire, syndic, artisan, garant.",
    type: "website",
    url: "https://talok.fr/solutions",
  },
};

export default function SolutionsIndexPage() {
  return <SolutionsIndexClient />;
}
