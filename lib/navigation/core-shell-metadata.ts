export type CoreShellRole = "owner" | "tenant" | "admin" | "provider";

interface CoreShellMatch {
  pattern: string;
  description: string;
}

interface CoreShellMetadataInput {
  role: CoreShellRole;
  pathname: string;
  fallbackTitle: string;
}

export interface CoreShellMetadata {
  title: string;
  roleLabel: string;
  description: string;
  mobileBrand: string;
}

const ROLE_LABELS: Record<CoreShellRole, string> = {
  owner: "Propriétaire",
  tenant: "Locataire",
  admin: "Admin",
  provider: "Prestataire",
};

const DEFAULT_DESCRIPTIONS: Record<CoreShellRole, string> = {
  owner: "Concentrez-vous sur la tâche qui débloque votre gestion.",
  tenant: "Concentrez-vous sur votre prochaine action utile.",
  admin: "Traitez d'abord les sujets bloquants avant d'analyser les tendances.",
  provider: "Concentrez-vous sur la prochaine intervention à traiter.",
};

const ROLE_MATCHERS: Record<CoreShellRole, CoreShellMatch[]> = {
  owner: [
    { pattern: "/owner/dashboard", description: "Priorisez vos prochaines actions sans vous disperser." },
    { pattern: "/owner/properties", description: "Gardez une vue claire sur votre portefeuille et ses priorités." },
    { pattern: "/owner/leases", description: "Suivez les signatures, entrées et sorties sans perdre le fil." },
    { pattern: "/owner/money", description: "Concentrez-vous sur les encaissements, relances et arbitrages utiles." },
    { pattern: "/owner/onboarding", description: "Terminez les réglages essentiels pour gérer sereinement vos locations." },
  ],
  tenant: [
    { pattern: "/tenant/dashboard", description: "Retrouvez vos actions importantes en un coup d'oeil." },
    { pattern: "/tenant/lease", description: "Retrouvez l'essentiel de votre logement sans chercher dans plusieurs écrans." },
    { pattern: "/tenant/payments", description: "Réglez vos échéances et suivez votre situation sans ambiguïté." },
    { pattern: "/tenant/documents", description: "Accédez à vos documents utiles et déposez ceux qui manquent." },
    { pattern: "/tenant/onboarding", description: "Finalisez les étapes qui rendent votre espace vraiment utilisable." },
  ],
  admin: [
    { pattern: "/admin/dashboard", description: "Commencez par les sujets bloquants de la plateforme, puis ouvrez les analyses utiles." },
    { pattern: "/admin/people", description: "Traitez d'abord les profils à vérifier avant d'explorer l'annuaire complet." },
    { pattern: "/admin/properties", description: "Surveillez les anomalies du parc avant les volumes globaux." },
    { pattern: "/admin/reports", description: "Utilisez les rapports pour confirmer les tendances après traitement des alertes." },
    { pattern: "/admin/moderation", description: "Faites remonter les cas sensibles avant la moderation de routine." },
  ],
  provider: [
    { pattern: "/provider/dashboard", description: "Priorisez les missions qui demandent une réponse rapide." },
  ],
};

export function getCoreShellMetadata({
  role,
  pathname,
  fallbackTitle,
}: CoreShellMetadataInput): CoreShellMetadata {
  const description =
    ROLE_MATCHERS[role].find((entry) => pathname === entry.pattern || pathname.startsWith(`${entry.pattern}/`))
      ?.description || DEFAULT_DESCRIPTIONS[role];

  return {
    title: fallbackTitle,
    roleLabel: ROLE_LABELS[role],
    description,
    mobileBrand: "Talok",
  };
}
