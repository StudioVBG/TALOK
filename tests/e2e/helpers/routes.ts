/**
 * Catalog of application routes used by E2E tests.
 *
 * Centralizing routes here means a route rename only requires updating one
 * line, not crawling 18 spec files. Add new routes as tests are added.
 */

export const routes = {
  auth: {
    signin: "/auth/signin",
    signup: "/auth/signup",
    forgotPassword: "/auth/forgot-password",
    verifyEmail: "/auth/verify-email",
  },
  owner: {
    dashboard: "/owner/dashboard",
    properties: "/owner/properties",
    propertiesNew: "/owner/properties/new",
    leases: "/owner/leases",
    finances: "/owner/finances",
    documents: "/owner/documents",
    accounting: {
      root: "/owner/accounting",
      balance: "/owner/accounting/balance",
      grandLivre: "/owner/accounting/grand-livre",
      entries: "/owner/accounting/entries",
      exercises: "/owner/accounting/exercises",
      exports: "/owner/accounting/exports",
      declarations: "/owner/accounting/declarations",
      declarationsTva: "/owner/accounting/declarations/tva",
      chart: "/owner/accounting/chart",
      bank: "/owner/accounting/bank",
      bankReconciliation: "/owner/accounting/bank/reconciliation",
      transfers: "/owner/accounting/transfers",
      upload: "/owner/accounting/upload",
      amortization: "/owner/accounting/amortization",
      rendement: "/owner/accounting/rendement",
      ec: "/owner/accounting/ec",
      propertyAcquisitions: "/owner/accounting/property-acquisitions",
      settings: "/owner/accounting/settings",
    },
  },
  tenant: {
    dashboard: "/tenant/dashboard",
  },
  admin: {
    dashboard: "/admin/dashboard",
  },
  agency: {
    dashboard: "/agency/dashboard",
    accounting: {
      root: "/agency/accounting",
      crg: "/agency/accounting/crg",
      hoguet: "/agency/accounting/hoguet",
      mandants: "/agency/accounting/mandants",
    },
  },
  syndic: {
    accounting: {
      root: "/syndic/accounting",
      appels: "/syndic/accounting/appels",
      budget: "/syndic/accounting/budget",
      close: "/syndic/accounting/close",
      entries: "/syndic/accounting/entries",
    },
  },
} as const;

/**
 * Regex helpers for `expect(page).toHaveURL(...)` assertions when we don't
 * need to pin the exact path (e.g. trailing query strings, locale segments).
 */
export const routePatterns = {
  signin: /\/auth\/signin/,
  ownerArea: /\/owner(\/|$)/,
  tenantArea: /\/tenant(\/|$)/,
  adminArea: /\/admin(\/|$)/,
  ownerDashboard: /\/owner\/dashboard/,
  ownerAccounting: /\/owner\/accounting/,
};
