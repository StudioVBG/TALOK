"use client";

/**
 * SOTA 2026 : Hooks React Query pour Stripe Connect (compte bancaire propriétaire).
 *
 * Multi-entité : chaque hook accepte un `entityId` optionnel.
 *   - undefined → compte personnel (entity_id IS NULL)
 *   - UUID      → compte scopé à une entité juridique (SCI, copropriété…)
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";
import type { ConnectAccountResponse } from "@/lib/stripe/connect-account";

// ── Types ──

export type ConnectAccountData = ConnectAccountResponse;

export interface ConnectBalanceData {
  available: number;
  pending: number;
  available_cents?: number;
  pending_cents?: number;
  currency: string;
  has_account?: boolean;
  account_not_ready?: boolean;
  missing_requirements?: string[];
  disabled_reason?: string | null;
}

export interface StripeTransfer {
  id: string;
  amount: number;
  currency: string;
  net_amount: number | null;
  platform_fee: number | null;
  stripe_fee: number | null;
  status: "pending" | "paid" | "failed" | "canceled" | "reversed";
  description: string | null;
  created_at: string;
  completed_at: string | null;
  invoice_id: string | null;
}

export interface StripePayout {
  id: string;
  stripe_payout_id: string;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "canceled" | "in_transit";
  arrival_date: string | null;
  paid_at: string | null;
  failure_code: string | null;
  failure_message: string | null;
  created_at: string;
}

export interface ConnectAccountListItem {
  id: string;
  entity_id: string | null;
  entity_label: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  bank_account_last4: string | null;
  bank_account_bank_name: string | null;
}

// ── Hooks ──

const CONNECT_STATUS_KEY = "stripe-connect-status";
const CONNECT_BALANCE_KEY = "stripe-connect-balance";
const CONNECT_TRANSFERS_KEY = "stripe-connect-transfers";
const CONNECT_PAYOUTS_KEY = "stripe-connect-payouts";
const CONNECT_ACCOUNTS_KEY = "stripe-connect-accounts";

function buildScopedUrl(base: string, entityId?: string | null): string {
  if (!entityId) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}entityId=${encodeURIComponent(entityId)}`;
}

export function useStripeConnectStatus(entityId?: string | null) {
  const { profile } = useAuth();

  return useQuery<ConnectAccountData>({
    queryKey: [CONNECT_STATUS_KEY, profile?.id, entityId ?? null],
    queryFn: async () => {
      const res = await fetch(buildScopedUrl("/api/stripe/connect", entityId));
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erreur chargement compte Connect");
      }
      return data;
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
  });
}

export function useStripeConnectBalance(enabled = true, entityId?: string | null) {
  const { profile } = useAuth();

  return useQuery<ConnectBalanceData>({
    queryKey: [CONNECT_BALANCE_KEY, profile?.id, entityId ?? null],
    queryFn: async () => {
      const res = await fetch(buildScopedUrl("/api/stripe/connect/balance", entityId));
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erreur chargement solde");
      }
      return data;
    },
    enabled: !!profile?.id && enabled,
    staleTime: 30_000,
  });
}

export function useStripeTransfers(enabled = true, entityId?: string | null) {
  const { profile } = useAuth();

  return useQuery<StripeTransfer[]>({
    queryKey: [CONNECT_TRANSFERS_KEY, profile?.id, entityId ?? null],
    queryFn: async () => {
      const res = await fetch(buildScopedUrl("/api/stripe/connect/transfers", entityId));
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erreur chargement transferts");
      }
      return data;
    },
    enabled: !!profile?.id && enabled,
    staleTime: 60_000,
  });
}

export function useStripePayouts(enabled = true, entityId?: string | null) {
  const { profile } = useAuth();

  return useQuery<StripePayout[]>({
    queryKey: [CONNECT_PAYOUTS_KEY, profile?.id, entityId ?? null],
    queryFn: async () => {
      const res = await fetch(buildScopedUrl("/api/stripe/connect/payouts", entityId));
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erreur chargement versements");
      }
      return data;
    },
    enabled: !!profile?.id && enabled,
    staleTime: 60_000,
  });
}

export function useStripeConnectAccounts(enabled = true) {
  const { profile } = useAuth();

  return useQuery<ConnectAccountListItem[]>({
    queryKey: [CONNECT_ACCOUNTS_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect/accounts");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Erreur chargement comptes Connect");
      }
      return data;
    },
    enabled: !!profile?.id && enabled,
    staleTime: 60_000,
  });
}
