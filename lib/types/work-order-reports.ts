// =====================================================
// Types pour les Rapports d'Intervention SOTA 2025
// =====================================================

/**
 * Types de rapport
 */
export type ReportType = 'arrival' | 'before' | 'during' | 'after' | 'completion';

/**
 * Types d'entrée de temps
 */
export type TimeEntryType = 'travel' | 'work' | 'break' | 'waiting';

/**
 * Types d'items de checklist
 */
export type ChecklistItemType = 'checkbox' | 'text' | 'number' | 'photo' | 'select' | 'rating';

/**
 * Item de media (photo/vidéo)
 */
export interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  storage_path: string;
  thumbnail_path?: string;
  caption?: string;
  taken_at: string;
  ai_analysis?: {
    description?: string;
    detected_issues?: string[];
    severity_score?: number;
  };
}

/**
 * Item de checklist (template)
 */
export interface ChecklistItem {
  id: string;
  label: string;
  type: ChecklistItemType;
  required: boolean;
  options?: string[];
  min?: number;
  max?: number;
  category?: 'sécurité' | 'qualité' | 'conformité' | 'diagnostic' | 'travaux' | 'documentation' | 'finition' | 'conseil';
}

/**
 * Template de checklist
 */
export interface ChecklistTemplate {
  id: string;
  service_type: string;
  intervention_type: string | null;
  name: string;
  description: string | null;
  items: ChecklistItem[];
  min_score_required: number;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Rapport d'intervention
 */
export interface WorkOrderReport {
  id: string;
  work_order_id: string;
  report_type: ReportType;
  reported_at: string;
  gps_latitude: number | null;
  gps_longitude: number | null;
  gps_accuracy: number | null;
  gps_address: string | null;
  media_items: MediaItem[];
  checklist_template_id: string | null;
  checklist_responses: Record<string, string | number | boolean>;
  checklist_score: number | null;
  technician_notes: string | null;
  anomalies_detected: string[];
  recommendations: string[];
  client_signature_url: string | null;
  client_signed_at: string | null;
  client_name: string | null;
  client_feedback: string | null;
  client_satisfaction: number | null;
  device_info: Record<string, unknown> | null;
  app_version: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Entrée de temps
 */
export interface WorkOrderTimeEntry {
  id: string;
  work_order_id: string;
  entry_type: TimeEntryType;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  description: string | null;
  start_latitude: number | null;
  start_longitude: number | null;
  created_by: string;
  created_at: string;
}

/**
 * Formulaire de création de rapport
 */
export interface CreateWorkOrderReportData {
  work_order_id: string;
  report_type: ReportType;
  gps_latitude?: number;
  gps_longitude?: number;
  gps_accuracy?: number;
  gps_address?: string;
  media_items?: MediaItem[];
  checklist_template_id?: string;
  checklist_responses?: Record<string, string | number | boolean>;
  technician_notes?: string;
  anomalies_detected?: string[];
  recommendations?: string[];
}

/**
 * Formulaire de signature client
 */
export interface ClientSignatureData {
  signature_url: string;
  client_name: string;
  feedback?: string;
  satisfaction?: number;
}

/**
 * Résumé d'un rapport d'intervention
 */
export interface WorkOrderReportSummary {
  work_order_id: string;
  status: string;
  scheduled: {
    start: string | null;
    end: string | null;
    duration_minutes: number | null;
  };
  actual: {
    start: string | null;
    end: string | null;
    duration_minutes: number | null;
  };
  punctuality_minutes: number | null;
  reports: Array<{
    id: string;
    type: ReportType;
    reported_at: string;
    photos_count: number;
    checklist_score: number | null;
    has_anomalies: boolean;
  }>;
  time_entries: Array<{
    type: TimeEntryType;
    duration_minutes: number;
  }>;
  total_work_time_minutes: number | null;
  quality_score: number | null;
  client_satisfaction: number | null;
  completion_notes: string | null;
}

// =====================================================
// Labels et constantes
// =====================================================

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  arrival: 'Arrivée sur site',
  before: 'État avant intervention',
  during: 'Pendant l\'intervention',
  after: 'État après intervention',
  completion: 'Rapport final',
};

export const REPORT_TYPE_DESCRIPTIONS: Record<ReportType, string> = {
  arrival: 'Confirmez votre arrivée sur le site d\'intervention',
  before: 'Documentez l\'état actuel avant de commencer les travaux',
  during: 'Ajoutez des photos et notes pendant l\'intervention',
  after: 'Documentez le résultat après les travaux',
  completion: 'Rapport final avec signature client',
};

export const TIME_ENTRY_TYPE_LABELS: Record<TimeEntryType, string> = {
  travel: 'Trajet',
  work: 'Travail',
  break: 'Pause',
  waiting: 'Attente',
};

export const TIME_ENTRY_TYPE_COLORS: Record<TimeEntryType, string> = {
  travel: 'bg-blue-100 text-blue-700',
  work: 'bg-green-100 text-green-700',
  break: 'bg-amber-100 text-amber-700',
  waiting: 'bg-gray-100 text-gray-700',
};

export const CHECKLIST_CATEGORY_LABELS: Record<string, string> = {
  sécurité: 'Sécurité',
  qualité: 'Qualité',
  conformité: 'Conformité',
  diagnostic: 'Diagnostic',
  travaux: 'Travaux',
  documentation: 'Documentation',
  finition: 'Finition',
  conseil: 'Conseil',
};

export const CHECKLIST_CATEGORY_COLORS: Record<string, string> = {
  sécurité: 'bg-red-100 text-red-700',
  qualité: 'bg-green-100 text-green-700',
  conformité: 'bg-blue-100 text-blue-700',
  diagnostic: 'bg-purple-100 text-purple-700',
  travaux: 'bg-orange-100 text-orange-700',
  documentation: 'bg-gray-100 text-gray-700',
  finition: 'bg-cyan-100 text-cyan-700',
  conseil: 'bg-amber-100 text-amber-700',
};

// =====================================================
// Helpers
// =====================================================

/**
 * Formater une durée en minutes
 */
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}min`;
}

/**
 * Calculer le temps total par type
 */
export function calculateTotalTimeByType(
  entries: WorkOrderTimeEntry[]
): Record<TimeEntryType, number> {
  const totals: Record<TimeEntryType, number> = {
    travel: 0,
    work: 0,
    break: 0,
    waiting: 0,
  };

  for (const entry of entries) {
    if (entry.duration_minutes) {
      totals[entry.entry_type] += entry.duration_minutes;
    }
  }

  return totals;
}

/**
 * Obtenir le pourcentage de completion de checklist
 */
export function getChecklistCompletionPercentage(
  template: ChecklistTemplate,
  responses: Record<string, unknown>
): number {
  const requiredItems = template.items.filter((item) => item.required);
  if (requiredItems.length === 0) return 100;

  const completedItems = requiredItems.filter((item) => {
    const response = responses[item.id];
    return response !== undefined && response !== null && response !== '' && response !== false;
  });

  return Math.round((completedItems.length / requiredItems.length) * 100);
}

