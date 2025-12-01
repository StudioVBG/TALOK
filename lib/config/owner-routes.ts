/**
 * Configuration des routes pour le compte propriétaire - SOTA 2025
 * Structure unifiée : toutes les routes utilisent /app/owner/*
 */

export const OWNER_BASE_PATH = "/app/owner";

export const OWNER_ROUTES = {
  dashboard: {
    path: "/app/owner/dashboard",
    name: "Tableau de bord",
    component: "OwnerDashboardPage",
    auth: ["owner"],
    icon: "LayoutDashboard",
  },
  properties: {
    path: "/app/owner/properties",
    name: "Mes biens",
    component: "OwnerPropertiesPage",
    auth: ["owner"],
    icon: "Building2",
  },
  contracts: {
    path: "/app/owner/contracts",
    name: "Baux & locataires",
    component: "OwnerContractsPage",
    auth: ["owner"],
    icon: "FileText",
  },
  leases: {
    path: "/app/owner/contracts",
    name: "Baux",
    component: "OwnerContractsPage",
    auth: ["owner"],
    icon: "FileText",
  },
  money: {
    path: "/app/owner/money",
    name: "Loyers & revenus",
    component: "OwnerMoneyPage",
    auth: ["owner"],
    icon: "Euro",
  },
  finances: {
    path: "/app/owner/money",
    name: "Finances",
    component: "OwnerMoneyPage",
    auth: ["owner"],
    icon: "Euro",
  },
  tickets: {
    path: "/app/owner/tickets",
    name: "Tickets",
    component: "OwnerTicketsPage",
    auth: ["owner"],
    icon: "Wrench",
  },
  documents: {
    path: "/app/owner/documents",
    name: "Documents",
    component: "OwnerDocumentsPage",
    auth: ["owner"],
    icon: "FileCheck",
  },
  inspections: {
    path: "/app/owner/inspections",
    name: "États des lieux",
    component: "OwnerInspectionsPage",
    auth: ["owner"],
    icon: "ClipboardCheck",
  },
  endOfLease: {
    path: "/app/owner/end-of-lease",
    name: "Fin de bail",
    component: "EndOfLeasePage",
    auth: ["owner"],
    icon: "CalendarClock",
  },
  support: {
    path: "/app/owner/support",
    name: "Aide & services",
    component: "OwnerSupportPage",
    auth: ["owner"],
    icon: "HelpCircle",
  },
  settings: {
    path: "/app/owner/profile",
    name: "Paramètres",
    component: "OwnerSettingsPage",
    auth: ["owner"],
    icon: "Settings",
  },
  profile: {
    path: "/app/owner/profile",
    name: "Mon profil",
    component: "OwnerProfilePage",
    auth: ["owner"],
    icon: "User",
  },
} as const;

export type OwnerRouteKey = keyof typeof OWNER_ROUTES;

/**
 * Configuration des routes pour le compte locataire - SOTA 2025
 * Structure unifiée : toutes les routes utilisent /app/tenant/*
 */
export const TENANT_BASE_PATH = "/app/tenant";

export const TENANT_ROUTES = {
  dashboard: {
    path: "/app/tenant/dashboard",
    name: "Tableau de bord",
    auth: ["tenant"],
    icon: "LayoutDashboard",
  },
  home: {
    path: "/app/tenant/lease",
    name: "Mon logement",
    auth: ["tenant"],
    icon: "Home",
  },
  lease: {
    path: "/app/tenant/lease",
    name: "Mon bail",
    auth: ["tenant"],
    icon: "FileText",
  },
  payments: {
    path: "/app/tenant/payments",
    name: "Paiements",
    auth: ["tenant"],
    icon: "CreditCard",
  },
  documents: {
    path: "/app/tenant/documents",
    name: "Documents",
    auth: ["tenant"],
    icon: "FileText",
  },
  tickets: {
    path: "/app/tenant/requests",
    name: "Demandes",
    auth: ["tenant"],
    icon: "Wrench",
  },
  requests: {
    path: "/app/tenant/requests",
    name: "Demandes",
    auth: ["tenant"],
    icon: "Wrench",
  },
  meters: {
    path: "/app/tenant/meters",
    name: "Compteurs",
    auth: ["tenant"],
    icon: "Gauge",
  },
  signatures: {
    path: "/app/tenant/signatures",
    name: "Signatures",
    auth: ["tenant"],
    icon: "FileSignature",
  },
  messages: {
    path: "/app/tenant/messages",
    name: "Messages",
    auth: ["tenant"],
    icon: "MessageSquare",
  },
  colocation: {
    path: "/app/tenant/colocation",
    name: "Colocation",
    auth: ["tenant"],
    icon: "Users",
  },
  help: {
    path: "/app/tenant/help",
    name: "Aide",
    auth: ["tenant"],
    icon: "HelpCircle",
  },
  settings: {
    path: "/app/tenant/settings",
    name: "Paramètres",
    auth: ["tenant"],
    icon: "Settings",
  },
} as const;

export type TenantRouteKey = keyof typeof TENANT_ROUTES;
