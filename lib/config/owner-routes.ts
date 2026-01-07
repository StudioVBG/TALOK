/**
 * Configuration des routes pour le compte propriétaire - SOTA 2025
 * Structure unifiée : toutes les routes utilisent /owner/*
 */

export const OWNER_BASE_PATH = "/owner";

export const OWNER_ROUTES = {
  dashboard: {
    path: "/owner/dashboard",
    name: "Tableau de bord",
    component: "OwnerDashboardPage",
    auth: ["owner"],
    icon: "LayoutDashboard",
  },
  properties: {
    path: "/owner/properties",
    name: "Mes biens",
    component: "OwnerPropertiesPage",
    auth: ["owner"],
    icon: "Building2",
  },
  contracts: {
    path: "/owner/leases",
    name: "Baux & locataires",
    component: "OwnerContractsPage",
    auth: ["owner"],
    icon: "FileText",
  },
  tenants: {
    path: "/owner/tenants",
    name: "Mes locataires",
    component: "OwnerTenantsPage",
    auth: ["owner"],
    icon: "Users",
  },
  leases: {
    path: "/owner/leases",
    name: "Baux",
    component: "OwnerContractsPage",
    auth: ["owner"],
    icon: "FileText",
  },
  money: {
    path: "/owner/money",
    name: "Loyers & revenus",
    component: "OwnerMoneyPage",
    auth: ["owner"],
    icon: "Euro",
  },
  finances: {
    path: "/owner/money",
    name: "Finances",
    component: "OwnerMoneyPage",
    auth: ["owner"],
    icon: "Euro",
  },
  tickets: {
    path: "/owner/tickets",
    name: "Tickets",
    component: "OwnerTicketsPage",
    auth: ["owner"],
    icon: "Wrench",
  },
  workOrders: {
    path: "/owner/work-orders",
    name: "Interventions",
    component: "OwnerWorkOrdersPage",
    auth: ["owner"],
    icon: "HardHat",
  },
  providers: {
    path: "/owner/providers",
    name: "Prestataires",
    component: "OwnerProvidersPage",
    auth: ["owner"],
    icon: "UserCog",
  },
  documents: {
    path: "/owner/documents",
    name: "Documents",
    component: "OwnerDocumentsPage",
    auth: ["owner"],
    icon: "FileCheck",
  },
  inspections: {
    path: "/owner/inspections",
    name: "États des lieux",
    component: "OwnerInspectionsPage",
    auth: ["owner"],
    icon: "ClipboardCheck",
  },
  endOfLease: {
    path: "/owner/end-of-lease",
    name: "Fin de bail",
    component: "EndOfLeasePage",
    auth: ["owner"],
    icon: "CalendarClock",
  },
  support: {
    path: "/owner/support",
    name: "Aide & services",
    component: "OwnerSupportPage",
    auth: ["owner"],
    icon: "HelpCircle",
  },
  settings: {
    path: "/owner/profile",
    name: "Paramètres",
    component: "OwnerSettingsPage",
    auth: ["owner"],
    icon: "Settings",
  },
  profile: {
    path: "/owner/profile",
    name: "Mon profil",
    component: "OwnerProfilePage",
    auth: ["owner"],
    icon: "User",
  },
  messages: {
    path: "/owner/messages",
    name: "Messages",
    component: "OwnerMessagesPage",
    auth: ["owner"],
    icon: "MessageSquare",
  },
  taxes: {
    path: "/owner/taxes",
    name: "Fiscalité",
    component: "OwnerTaxesPage",
    auth: ["owner"],
    icon: "Calculator",
  },
  analytics: {
    path: "/owner/analytics",
    name: "Analytics",
    component: "OwnerAnalyticsPage",
    auth: ["owner"],
    icon: "BarChart3",
  },
} as const;

export type OwnerRouteKey = keyof typeof OWNER_ROUTES;

/**
 * Configuration des routes pour le compte locataire - SOTA 2025
 * Structure unifiée : toutes les routes utilisent /tenant/*
 */
export const TENANT_BASE_PATH = "/tenant";

export const TENANT_ROUTES = {
  dashboard: {
    path: "/tenant/dashboard",
    name: "Tableau de bord",
    auth: ["tenant"],
    icon: "LayoutDashboard",
  },
  home: {
    path: "/tenant/lease",
    name: "Mon logement",
    auth: ["tenant"],
    icon: "Home",
  },
  lease: {
    path: "/tenant/lease",
    name: "Mon bail",
    auth: ["tenant"],
    icon: "FileText",
  },
  payments: {
    path: "/tenant/payments",
    name: "Paiements",
    auth: ["tenant"],
    icon: "CreditCard",
  },
  documents: {
    path: "/tenant/documents",
    name: "Documents",
    auth: ["tenant"],
    icon: "FileText",
  },
  tickets: {
    path: "/tenant/requests",
    name: "Demandes",
    auth: ["tenant"],
    icon: "Wrench",
  },
  requests: {
    path: "/tenant/requests",
    name: "Demandes",
    auth: ["tenant"],
    icon: "Wrench",
  },
  meters: {
    path: "/tenant/meters",
    name: "Compteurs",
    auth: ["tenant"],
    icon: "Gauge",
  },
  signatures: {
    path: "/tenant/signatures",
    name: "Signatures",
    auth: ["tenant"],
    icon: "FileSignature",
  },
  messages: {
    path: "/tenant/messages",
    name: "Messages",
    auth: ["tenant"],
    icon: "MessageSquare",
  },
  colocation: {
    path: "/tenant/colocation",
    name: "Colocation",
    auth: ["tenant"],
    icon: "Users",
  },
  help: {
    path: "/tenant/help",
    name: "Aide",
    auth: ["tenant"],
    icon: "HelpCircle",
  },
  settings: {
    path: "/tenant/settings",
    name: "Paramètres",
    auth: ["tenant"],
    icon: "Settings",
  },
} as const;

export type TenantRouteKey = keyof typeof TENANT_ROUTES;
