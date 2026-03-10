"use client";

/**
 * SOTA 2026 : Hooks React Query pour Stripe Connect (compte bancaire propriétaire).
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/use-auth";

// ── Types ──

export interface ConnectAccountData {
  has_account: boolean;
  account: {
    is_ready: boolean;
    charges_enabled?: boolean;
    payouts_enabled?: boolean;
    details_submitted?: boolean;
    bank_account?: { last4: string; bank_name?: string } | null;
  } | null;
}

export interface ConnectBalanceData {
  available: number;
  pending: number;
  available_cents?: number;
  pending_cents?: number;
  currency: string;
  account_not_ready?: boolean;
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

// ── Hooks ──

const CONNECT_STATUS_KEY = "stripe-connect-status";
const CONNECT_BALANCE_KEY = "stripe-connect-balance";
const CONNECT_TRANSFERS_KEY = "stripe-connect-transfers";

export function useStripeConnectStatus() {
  const { profile } = useAuth();

  return useQuery<ConnectAccountData>({
    queryKey: [CONNECT_STATUS_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect");
      if (!res.ok) throw new Error("Erreur chargement compte Connect");
      return res.json();
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
  });
}

export function useStripeConnectBalance() {
  const { profile } = useAuth();

  return useQuery<ConnectBalanceData>({
    queryKey: [CONNECT_BALANCE_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect/balance");
      if (!res.ok) throw new Error("Erreur chargement solde");
      return res.json();
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });
}

export function useStripeTransfers() {
  const { profile } = useAuth();

  return useQuery<StripeTransfer[]>({
    queryKey: [CONNECT_TRANSFERS_KEY, profile?.id],
    queryFn: async () => {
      const res = await fetch("/api/stripe/connect/transfers");
      if (!res.ok) throw new Error("Erreur chargement transferts");
      return res.json();
    },
    enabled: !!profile?.id,
    staleTime: 60_000,
  });
}
