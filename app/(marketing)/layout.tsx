import { PublicFooter } from "@/components/layout/public-footer";

/**
 * Layout pour les pages marketing publiques
 *
 * Ce layout ajoute automatiquement le PublicFooter a toutes les pages
 * du groupe (marketing).
 *
 * Pages a migrer ici (futures migrations) :
 * - /fonctionnalites/*
 * - /pricing
 * - /contact
 * - /blog/*
 * - /temoignages
 * - /guides/*
 * - /outils/*
 * - /solutions/*
 * - /a-propos
 *
 * Note: La Navbar est deja dans le root layout et s'affiche
 * sur ces pages publiques (elle se masque uniquement sur /owner, /tenant, etc.)
 */
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <PublicFooter variant="dark" />
    </>
  );
}
