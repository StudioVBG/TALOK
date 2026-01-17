/**
 * Types for Admin Plans Management
 * Extracted from app/admin/plans/page.tsx
 */

export interface PlanFeatures {
  signatures?: boolean;
  signatures_monthly_quota?: number;
  lease_generation?: boolean;
  lease_templates?: "basic" | "full" | "custom";
  edl_digital?: boolean;
  attestations?: boolean;
  ocr_documents?: boolean;
  storage_gb?: number;
  email_templates?: boolean;
  open_banking?: boolean;
  open_banking_level?: "none" | "basic" | "advanced" | "premium";
  bank_reconciliation?: boolean;
  auto_reminders?: boolean;
  auto_reminders_sms?: boolean;
  irl_revision?: boolean;
  alerts_deadlines?: boolean;
  deposit_tracking?: boolean;
  tenant_payment_online?: boolean;
  export_csv?: boolean;
  export_excel?: boolean;
  export_accounting?: boolean;
  tenant_portal?: "none" | "basic" | "advanced" | "whitelabel";
  colocation?: boolean;
  multi_units?: boolean;
  multi_users?: boolean;
  max_users?: number;
  roles_permissions?: boolean;
  activity_log?: boolean;
  multi_mandants?: boolean;
  owner_reports?: boolean;
  work_orders?: boolean;
  work_orders_planning?: boolean;
  providers_management?: boolean;
  channel_manager?: "none" | "basic" | "full";
  api_access?: boolean;
  api_access_level?: "none" | "basic" | "full";
  webhooks?: boolean;
  white_label?: boolean;
  sso?: boolean;
  priority_support?: boolean;
  support_phone?: boolean;
  onboarding?: boolean;
  data_import?: boolean;
  custom_sla?: boolean;
  account_manager?: boolean;
  scoring_ia?: boolean;
}

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_properties: number;
  max_leases: number;
  max_tenants: number;
  max_documents_gb: number;
  included_properties: number;
  extra_property_price: number;
  billing_type: "fixed" | "per_unit" | "tiered";
  features: PlanFeatures;
  is_active: boolean;
  is_popular: boolean;
  display_order: number;
  active_subscribers_count?: number;
}

export interface Addon {
  id: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  features: Record<string, unknown>;
  compatible_plans: string[];
  is_active: boolean;
  display_order: number;
  active_subscriptions_count?: number;
}

export interface FeatureDefinition {
  key: string;
  label: string;
  type: "boolean" | "number" | "level";
  unlimited?: number;
  levels?: string[];
}

export interface FeatureGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  features: FeatureDefinition[];
}

export interface PlanColorScheme {
  bg: string;
  border: string;
  text: string;
  gradient: string;
  ring: string;
}
