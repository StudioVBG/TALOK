"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { Fragment, useMemo } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  homeHref?: string;
  showHome?: boolean;
  className?: string;
  separator?: React.ReactNode;
}

// Mapping des segments d'URL vers des labels lisibles
const SEGMENT_LABELS: Record<string, string> = {
  // Routes principales
  app: "",
  owner: "Propriétaire",
  tenant: "Locataire",
  admin: "Administration",
  vendor: "Prestataire",
  provider: "Prestataire",
  guarantor: "Garant",
  
  // Sections owner
  dashboard: "Tableau de bord",
  properties: "Mes biens",
  contracts: "Contrats",
  money: "Finances",
  documents: "Documents",
  onboarding: "Configuration",
  settings: "Paramètres",
  
  // Sections tenant
  lease: "Mon bail",
  payments: "Paiements",
  requests: "Demandes",
  profile: "Profil",
  
  // Sections admin
  overview: "Vue d'ensemble",
  people: "Utilisateurs",
  templates: "Modèles",
  integrations: "Intégrations",
  tests: "Tests",
  
  // Actions communes
  new: "Nouveau",
  edit: "Modifier",
  view: "Détails",
  upload: "Téléverser",
  
  // Pages légales
  legal: "Mentions légales",
  terms: "CGU",
  privacy: "Confidentialité",
  
  // Auth
  auth: "",
  signin: "Connexion",
  signup: "Inscription",
};

/**
 * Génère automatiquement les breadcrumbs à partir du pathname
 */
function generateBreadcrumbs(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];
  let currentPath = "";

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Ignorer certains segments (comme "app")
    const label = SEGMENT_LABELS[segment];
    if (label === "") continue;

    // Détecter les UUIDs et les remplacer par un label générique
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment);
    
    breadcrumbs.push({
      label: isUuid ? "Détails" : (label || segment.charAt(0).toUpperCase() + segment.slice(1)),
      href: i < segments.length - 1 ? currentPath : undefined, // Pas de lien pour le dernier élément
    });
  }

  return breadcrumbs;
}

/**
 * Composant Breadcrumb avec génération automatique
 * 
 * @example
 * // Génération automatique basée sur l'URL
 * <Breadcrumb />
 * 
 * @example
 * // Items personnalisés
 * <Breadcrumb items={[
 *   { label: "Mes biens", href: "/owner/properties" },
 *   { label: "Appartement Paris" }
 * ]} />
 */
export function Breadcrumb({
  items,
  homeHref = "/",
  showHome = true,
  className,
  separator = <ChevronRight className="h-4 w-4 text-muted-foreground/60" />,
}: BreadcrumbProps) {
  const pathname = usePathname();
  
  // Générer les breadcrumbs automatiquement si pas d'items fournis
  const breadcrumbItems = useMemo(() => {
    if (items && items.length > 0) return items;
    return generateBreadcrumbs(pathname);
  }, [items, pathname]);

  // Ne rien afficher si on est sur la home ou s'il n'y a qu'un seul élément
  if (pathname === "/" || breadcrumbItems.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Fil d'Ariane"
      className={cn("flex items-center text-sm text-muted-foreground", className)}
    >
      <ol className="flex items-center gap-1.5 flex-wrap">
        {/* Home */}
        {showHome && (
          <>
            <li>
              <Link
                href={homeHref}
                className="flex items-center hover:text-foreground transition-colors"
                aria-label="Accueil"
              >
                <Home className="h-4 w-4" />
              </Link>
            </li>
            {breadcrumbItems.length > 0 && (
              <li className="flex items-center" aria-hidden="true">
                {separator}
              </li>
            )}
          </>
        )}

        {/* Items */}
        {breadcrumbItems.map((item, index) => (
          <Fragment key={index}>
            <li className="flex items-center">
              {item.href ? (
                <Link
                  href={item.href}
                  className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  {item.icon}
                  <span>{item.label}</span>
                </span>
              )}
            </li>
            {index < breadcrumbItems.length - 1 && (
              <li className="flex items-center" aria-hidden="true">
                {separator}
              </li>
            )}
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Version compacte du breadcrumb pour mobile
 */
export function BreadcrumbCompact({ className }: { className?: string }) {
  const pathname = usePathname();
  const breadcrumbs = useMemo(() => generateBreadcrumbs(pathname), [pathname]);

  if (breadcrumbs.length <= 1) return null;

  const previousItem = breadcrumbs[breadcrumbs.length - 2];

  return (
    <nav
      aria-label="Navigation"
      className={cn("flex items-center text-sm", className)}
    >
      <Link
        href={previousItem.href || "/"}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span>Retour</span>
      </Link>
    </nav>
  );
}

export default Breadcrumb;

