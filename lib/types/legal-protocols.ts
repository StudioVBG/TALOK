/**
 * Types pour les protocoles juridiques anti-squat et protection locataire
 * Basés sur la loi du 27 juillet 2023 (Kasbarian-Bergé)
 */

export type ProtocolType = 
  | "anti_squat_owner" 
  | "prevention_owner" 
  | "protection_tenant";

export type StepPriority = "critique" | "important" | "recommandé";

export type StepStatus = "pending" | "in_progress" | "completed" | "skipped";

/**
 * Document juridique requis pour une étape
 */
export interface LegalDocument {
  id: string;
  name: string;
  description: string;
  required: boolean;
  template_url?: string;
}

/**
 * Contact utile (préfecture, ADIL, tribunal, etc.)
 */
export interface LegalContact {
  role: string;
  name?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
  opening_hours?: string;
  notes: string;
}

/**
 * Étape d'un protocole juridique
 */
export interface ProtocolStep {
  id: string;
  order: number;
  title: string;
  description: string;
  detailed_actions: string[];
  priority: StepPriority;
  estimated_duration: string;
  deadline_info?: string;
  legal_reference?: string;
  warning?: string;
  documents: LegalDocument[];
  contacts: LegalContact[];
  forbidden_actions?: string[];
}

/**
 * Protocole juridique complet
 */
export interface LegalProtocol {
  id: ProtocolType;
  title: string;
  subtitle: string;
  icon: string;
  target_role: "owner" | "tenant" | "both";
  steps: ProtocolStep[];
  emergency_contacts: LegalContact[];
  last_updated: string;
  legal_source: string;
}

/**
 * Suivi de progression d'un utilisateur sur un protocole
 */
export interface ProtocolProgress {
  id: string;
  user_id: string;
  protocol_type: ProtocolType;
  property_id?: string;
  lease_id?: string;
  current_step: number;
  steps_status: Record<string, StepStatus>;
  started_at: string;
  completed_at?: string;
  notes: Record<string, string>;
}

/**
 * Contact géolocalisé avec informations complètes
 */
export interface LocalizedContact {
  role: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  url?: string;
  opening_hours?: string;
  notes: string;
  distance_km?: number;
}

/**
 * Contacts par département
 */
export interface DepartmentContacts {
  department_code: string;
  department_name: string;
  region: string;
  prefecture: LocalizedContact;
  adil: LocalizedContact | null;
  tribunal_judiciaire: LocalizedContact;
  commissariat_principal: LocalizedContact;
  gendarmerie?: LocalizedContact;
  emergency_contacts: LocalizedContact[];
}







