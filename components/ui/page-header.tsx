"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface PageHeaderProps {
  /**
   * Titre principal de la page (h1)
   */
  title: string;
  /**
   * Description optionnelle sous le titre
   */
  description?: string;
  /**
   * Items du fil d'Ariane
   */
  breadcrumbs?: BreadcrumbItem[];
  /**
   * Actions à afficher à droite du header
   */
  actions?: React.ReactNode;
  /**
   * Classe CSS additionnelle
   */
  className?: string;
  /**
   * Afficher le bouton retour (pour les pages de détail)
   */
  showBack?: boolean;
  /**
   * URL de retour
   */
  backHref?: string;
  /**
   * Label du bouton retour
   */
  backLabel?: string;
}

/**
 * PageHeader - Composant d'en-tête de page standardisé
 *
 * Features:
 * - Titre h1 pour l'accessibilité et SEO
 * - Fil d'Ariane avec schema.org BreadcrumbList
 * - Actions alignées à droite
 * - Responsive: empile sur mobile
 *
 * Usage:
 * ```tsx
 * <PageHeader
 *   title="Mes biens"
 *   description="Gérez vos biens immobiliers"
 *   breadcrumbs={[
 *     { label: "Tableau de bord", href: "/owner" },
 *     { label: "Mes biens" }
 *   ]}
 *   actions={<Button>Ajouter un bien</Button>}
 * />
 * ```
 */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
  showBack,
  backHref,
  backLabel = "Retour",
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6 space-y-4", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} />
      )}

      {/* Title and Actions Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {showBack && backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              {backLabel}
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

/**
 * Breadcrumbs - Fil d'Ariane accessible avec schema.org
 */
interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /**
   * Afficher l'icône Home pour le premier élément
   * @default true
   */
  showHomeIcon?: boolean;
}

export function Breadcrumbs({
  items,
  className,
  showHomeIcon = true,
}: BreadcrumbsProps) {
  if (!items.length) return null;

  // Générer le schema.org JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href && { item: item.href }),
    })),
  };

  return (
    <>
      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Navigation */}
      <nav
        aria-label="Fil d'Ariane"
        className={cn("flex items-center text-sm text-muted-foreground", className)}
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isFirst = index === 0;

            return (
              <li key={item.label} className="flex items-center gap-1.5">
                {/* Separator */}
                {!isFirst && (
                  <ChevronRight
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground/50"
                    aria-hidden="true"
                  />
                )}

                {/* Breadcrumb item */}
                {isLast ? (
                  <span
                    className="font-medium text-foreground"
                    aria-current="page"
                  >
                    {item.icon && (
                      <span className="mr-1.5" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </span>
                ) : item.href ? (
                  <Link
                    href={item.href}
                    className="inline-flex items-center hover:text-foreground transition-colors"
                  >
                    {isFirst && showHomeIcon && !item.icon ? (
                      <Home className="h-4 w-4" aria-hidden="true" />
                    ) : item.icon ? (
                      <span className="mr-1.5" aria-hidden="true">
                        {item.icon}
                      </span>
                    ) : null}
                    <span className={isFirst && showHomeIcon ? "sr-only sm:not-sr-only sm:ml-1.5" : ""}>
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <span className="inline-flex items-center">
                    {item.icon && (
                      <span className="mr-1.5" aria-hidden="true">
                        {item.icon}
                      </span>
                    )}
                    {item.label}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}

/**
 * Hook pour générer automatiquement les breadcrumbs depuis le pathname
 */
export function useAutoBreadcrumbs(
  pathLabels: Record<string, string> = {}
): BreadcrumbItem[] {
  const pathname = usePathname();

  return React.useMemo(() => {
    if (!pathname) return [];

    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];
    let currentPath = "";

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      currentPath += `/${segment}`;
      const isLast = i === segments.length - 1;

      // Skip dynamic segments like [id]
      if (segment.startsWith("[") || segment.match(/^[a-f0-9-]{36}$/)) {
        continue;
      }

      // Get label from provided map or capitalize segment
      const label = pathLabels[segment] || pathLabels[currentPath] || formatSegment(segment);

      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    }

    return breadcrumbs;
  }, [pathname, pathLabels]);
}

/**
 * Formate un segment d'URL en label lisible
 */
function formatSegment(segment: string): string {
  return segment
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Labels français pour les routes courantes
 */
export const frenchPathLabels: Record<string, string> = {
  owner: "Tableau de bord",
  tenant: "Espace locataire",
  provider: "Espace prestataire",
  admin: "Administration",
  properties: "Mes biens",
  leases: "Baux & locataires",
  money: "Loyers & revenus",
  documents: "Documents",
  inspections: "États des lieux",
  tickets: "Tickets",
  tenants: "Locataires",
  analytics: "Analyses",
  indexation: "Indexation",
  diagnostics: "Diagnostics",
  "end-of-lease": "Fin de bail",
  profile: "Mon profil",
  support: "Aide & services",
  "legal-protocols": "Protocoles juridiques",
  providers: "Prestataires",
  messages: "Messages",
  visits: "Visites",
  taxes: "Fiscalité",
  settings: "Paramètres",
  new: "Nouveau",
  edit: "Modifier",
  upload: "Téléverser",
  banking: "Informations bancaires",
  identity: "Identité",
  payments: "Paiements",
  receipts: "Quittances",
  requests: "Demandes",
  meters: "Compteurs",
  jobs: "Interventions",
  quotes: "Devis",
  invoices: "Factures",
  calendar: "Calendrier",
  compliance: "Conformité",
};
