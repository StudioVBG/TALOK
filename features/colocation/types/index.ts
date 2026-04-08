/**
 * Types et schemas Zod pour le module colocation
 * SOTA 2026
 */

import { z } from "zod";

// ============================================================
// Enums
// ============================================================

export const COLOCATION_TYPES = ["bail_unique", "baux_individuels"] as const;
export type ColocationType = (typeof COLOCATION_TYPES)[number];

export const MEMBER_STATUSES = ["pending", "active", "departing", "departed"] as const;
export type MemberStatus = (typeof MEMBER_STATUSES)[number];

export const RULE_CATEGORIES = [
  "general", "menage", "bruit", "invites", "animaux",
  "espaces_communs", "charges", "autre",
] as const;
export type RuleCategory = (typeof RULE_CATEGORIES)[number];

export const TASK_RECURRENCES = ["daily", "weekly", "biweekly", "monthly"] as const;
export type TaskRecurrence = (typeof TASK_RECURRENCES)[number];

export const EXPENSE_CATEGORIES = [
  "menage", "courses", "internet", "electricite",
  "eau", "reparation", "autre",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_SPLIT_TYPES = ["equal", "by_room", "custom"] as const;
export type ExpenseSplitType = (typeof EXPENSE_SPLIT_TYPES)[number];

// ============================================================
// Labels (FR)
// ============================================================

export const RULE_CATEGORY_LABELS: Record<RuleCategory, string> = {
  general: "General",
  menage: "Menage",
  bruit: "Bruit",
  invites: "Invites",
  animaux: "Animaux",
  espaces_communs: "Espaces communs",
  charges: "Charges",
  autre: "Autre",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  menage: "Menage",
  courses: "Courses",
  internet: "Internet",
  electricite: "Electricite",
  eau: "Eau",
  reparation: "Reparation",
  autre: "Autre",
};

export const MEMBER_STATUS_LABELS: Record<MemberStatus, string> = {
  pending: "En attente",
  active: "Actif",
  departing: "En depart",
  departed: "Parti",
};

// ============================================================
// Zod Schemas
// ============================================================

// Room
export const createRoomSchema = z.object({
  property_id: z.string().uuid(),
  room_number: z.string().min(1, "Numero de chambre requis"),
  room_label: z.string().optional(),
  surface_m2: z
    .number()
    .min(9, "Surface minimum 9m2 (loi ELAN)")
    .optional(),
  rent_share_cents: z
    .number()
    .int()
    .min(0, "Le loyer ne peut pas etre negatif"),
  charges_share_cents: z.number().int().min(0).default(0),
  is_furnished: z.boolean().default(false),
  description: z.string().optional(),
  photos: z.array(z.object({
    url: z.string().url(),
    caption: z.string().optional(),
  })).default([]),
});

export const updateRoomSchema = createRoomSchema.partial().omit({ property_id: true });

// Member
export const createMemberSchema = z.object({
  property_id: z.string().uuid(),
  room_id: z.string().uuid().optional(),
  lease_id: z.string().uuid(),
  tenant_profile_id: z.string().uuid(),
  move_in_date: z.string(),
  rent_share_cents: z.number().int().min(0),
  charges_share_cents: z.number().int().min(0).default(0),
  deposit_cents: z.number().int().min(0).default(0),
  pays_individually: z.boolean().default(false),
});

export const declareDepartureSchema = z.object({
  notice_effective_date: z.string(),
});

export const replaceMemberSchema = z.object({
  new_tenant_profile_id: z.string().uuid(),
  new_move_in_date: z.string(),
  new_rent_share_cents: z.number().int().min(0).optional(),
  new_charges_share_cents: z.number().int().min(0).optional(),
  new_deposit_cents: z.number().int().min(0).optional(),
});

// Rule
export const createRuleSchema = z.object({
  property_id: z.string().uuid(),
  title: z.string().min(1, "Titre requis"),
  category: z.enum(RULE_CATEGORIES).default("general"),
  description: z.string().min(1, "Description requise"),
  sort_order: z.number().int().default(0),
});

export const updateRuleSchema = createRuleSchema
  .partial()
  .omit({ property_id: true })
  .extend({ is_active: z.boolean().optional() });

// Task
export const createTaskSchema = z.object({
  property_id: z.string().uuid(),
  title: z.string().min(1, "Titre requis"),
  description: z.string().optional(),
  recurrence: z.enum(TASK_RECURRENCES).default("weekly"),
  assigned_member_id: z.string().uuid().optional(),
  assigned_room_id: z.string().uuid().optional(),
  due_date: z.string().optional(),
  rotation_enabled: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const updateTaskSchema = createTaskSchema.partial().omit({ property_id: true });

export const completeTaskSchema = z.object({
  completed_by: z.string().uuid(),
});

// Expense
export const createExpenseSchema = z.object({
  property_id: z.string().uuid(),
  paid_by_member_id: z.string().uuid(),
  title: z.string().min(1, "Titre requis"),
  amount_cents: z.number().int().min(1, "Montant requis"),
  category: z.enum(EXPENSE_CATEGORIES).default("autre"),
  split_type: z.enum(EXPENSE_SPLIT_TYPES).default("equal"),
  split_details: z.record(z.number().int()).optional(),
  receipt_document_id: z.string().uuid().optional(),
  date: z.string().optional(),
});

export const settleExpenseSchema = z.object({
  expense_ids: z.array(z.string().uuid()).optional(),
  payer_id: z.string().uuid(),
  debtor_id: z.string().uuid(),
});

// ============================================================
// Interfaces (enrichies avec jointures)
// ============================================================

export interface ColocationRoomWithOccupant {
  id: string;
  property_id: string;
  room_number: string;
  room_label: string | null;
  surface_m2: number | null;
  rent_share_cents: number;
  charges_share_cents: number;
  is_furnished: boolean;
  description: string | null;
  photos: Array<{ url: string; caption?: string }>;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  occupant?: {
    id: string;
    tenant_profile_id: string;
    status: MemberStatus;
    move_in_date: string;
    profile?: {
      prenom: string | null;
      nom: string | null;
      avatar_url: string | null;
      email: string | null;
    };
  } | null;
}

export interface ColocationMemberWithDetails {
  id: string;
  property_id: string;
  room_id: string | null;
  lease_id: string;
  tenant_profile_id: string;
  status: MemberStatus;
  move_in_date: string;
  move_out_date: string | null;
  notice_given_at: string | null;
  notice_effective_date: string | null;
  solidarity_end_date: string | null;
  rent_share_cents: number;
  charges_share_cents: number;
  deposit_cents: number;
  deposit_returned: boolean;
  pays_individually: boolean;
  replaced_by_member_id: string | null;
  replaces_member_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  profile?: {
    id: string;
    prenom: string | null;
    nom: string | null;
    avatar_url: string | null;
    email: string | null;
    telephone: string | null;
  };
  room?: {
    room_number: string;
    room_label: string | null;
  } | null;
}

export interface ColocationDashboardData {
  property_id: string;
  colocation_type: ColocationType;
  has_solidarity_clause: boolean;
  rooms: ColocationRoomWithOccupant[];
  members: ColocationMemberWithDetails[];
  active_members_count: number;
  total_rent_cents: number;
  occupied_rooms: number;
  available_rooms: number;
  pending_tasks: number;
  unsettled_expenses_cents: number;
}

export interface ColocationBalanceEntry {
  property_id: string;
  payer_id: string;
  debtor_id: string;
  total_owed_cents: number;
  payer_name?: string;
  debtor_name?: string;
}
