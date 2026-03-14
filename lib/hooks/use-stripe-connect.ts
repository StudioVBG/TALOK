"use client";

/**
 * SOTA 2026 : Hooks React Query pour Stripe Connect (compte bancaire propriétaire).
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

// ── Hooks ──

const CONNECT_STATUS_KEY = "stripe-connect-status";
const CONNECT_BALANCE_KEY = "stripe-connect-balance";
const CONNECT_TRANSFERS_KEY = "stripe-connect-transfers";
const CONNECT_PAYOUTS_KEY = "stripe-connect-payouts";

export function useStripeConnectStatus() {
  const { profile } = useAuth();

  return useQuery<ConnectAccountData>({
    queryKey: [CONNECT_STATUS_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect");
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

export function useStripeConnectBalance(enabled = true) {
  const { profile } = useAuth();

  return useQuery<ConnectBalanceData>({
    queryKey: [CONNECT_BALANCE_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect/balance");
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

export function useStripeTransfers(enabled = true) {
  const { profile } = useAuth();

  return useQuery<StripeTransfer[]>({
    queryKey: [CONNECT_TRANSFERS_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect/transfers");
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

export function useStripePayouts(enabled = true) {
  const { profile } = useAuth();

  return useQuery<StripePayout[]>({
    queryKey: [CONNECT_PAYOUTS_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect/payouts");
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
