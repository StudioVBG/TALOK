/**
 * MSW Request Handlers
 *
 * Definit les handlers par defaut pour les API routes les plus utilisees.
 * Les tests peuvent overrider ces handlers avec server.use(...) pour des cas specifiques.
 */

import { http, HttpResponse } from "msw";

const API_BASE = "http://localhost:3000/api";

// =============================================================================
// Auth & Profile
// =============================================================================

const authHandlers = [
  http.get(`${API_BASE}/auth/session`, () => {
    return HttpResponse.json({
      user: {
        id: "test-user-id",
        email: "test@talok.fr",
        role: "owner",
      },
    });
  }),

  http.get(`${API_BASE}/auth/profile`, () => {
    return HttpResponse.json({
      data: {
        id: "test-profile-id",
        user_id: "test-user-id",
        role: "owner",
        first_name: "Marie-Line",
        last_name: "VOLBERG",
        email: "test@talok.fr",
      },
    });
  }),
];

// =============================================================================
// Properties
// =============================================================================

const propertyHandlers = [
  http.get(`${API_BASE}/properties`, () => {
    return HttpResponse.json({
      data: [
        {
          id: "prop-1",
          name: "Appartement Fort-de-France",
          address: "12 rue Victor Hugo",
          city: "Fort-de-France",
          postal_code: "97200",
          type: "appartement",
          status: "loue",
        },
      ],
      meta: { total: 1, page: 1, limit: 50 },
    });
  }),

  http.get(`${API_BASE}/properties/:id`, ({ params }) => {
    return HttpResponse.json({
      data: {
        id: params.id,
        name: "Appartement Fort-de-France",
        address: "12 rue Victor Hugo",
        city: "Fort-de-France",
        postal_code: "97200",
        type: "appartement",
        status: "loue",
      },
    });
  }),
];

// =============================================================================
// Leases
// =============================================================================

const leaseHandlers = [
  http.get(`${API_BASE}/leases`, () => {
    return HttpResponse.json({
      data: [
        {
          id: "lease-1",
          property_id: "prop-1",
          status: "active",
          start_date: "2025-01-01",
          end_date: "2028-01-01",
          monthly_rent: 850,
          charges: 50,
        },
      ],
      meta: { total: 1 },
    });
  }),
];

// =============================================================================
// Invoices
// =============================================================================

const invoiceHandlers = [
  http.get(`${API_BASE}/invoices`, () => {
    return HttpResponse.json({
      data: [],
      meta: { total: 0 },
    });
  }),
];

// =============================================================================
// Accounting
// =============================================================================

const accountingHandlers = [
  http.get(`${API_BASE}/accounting/balance`, () => {
    return HttpResponse.json({
      data: {
        date: new Date().toISOString(),
        comptes_proprietaires: [],
        comptes_locataires: [],
        total_proprietaires: { debit: 0, credit: 0 },
        total_locataires: { debit: 0, credit: 0 },
        verification: { equilibre: true, ecart: 0 },
      },
    });
  }),

  http.get(`${API_BASE}/accounting/crg`, () => {
    return HttpResponse.json({ data: [] });
  }),

  http.get(`${API_BASE}/accounting/fiscal`, () => {
    return HttpResponse.json({ data: null });
  }),

  http.get(`${API_BASE}/accounting/deposits`, () => {
    return HttpResponse.json({ data: [] });
  }),

  http.get(`${API_BASE}/accounting/situation/:tenantId`, () => {
    return HttpResponse.json({
      success: true,
      data: { solde: 0, statut: "a_jour", derniers_paiements: [] },
    });
  }),
];

// =============================================================================
// Export all handlers
// =============================================================================

export const handlers = [
  ...authHandlers,
  ...propertyHandlers,
  ...leaseHandlers,
  ...invoiceHandlers,
  ...accountingHandlers,
];
