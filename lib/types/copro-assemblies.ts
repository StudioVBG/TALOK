// =====================================================
// Types TypeScript pour les Assemblées Générales COPRO
// =====================================================

// =====================================================
// TYPES DE BASE
// =====================================================

export type AssemblyType = 'AGO' | 'AGE' | 'AGM';
export type LocationType = 'physical' | 'video' | 'hybrid';

export type AssemblyStatus = 
  | 'draft'        // Brouillon
  | 'convoked'     // Convocation envoyée
  | 'in_progress'  // En cours
  | 'suspended'    // Suspendue
  | 'closed'       // Clôturée
  | 'cancelled';   // Annulée

export type MajorityType = 
  | 'simple'       // Article 24
  | 'absolute'     // Article 25
  | 'double'       // Article 26
  | 'unanimity';   // Unanimité

export type MotionCategory = 
  | 'general'
  | 'budget'
  | 'travaux_courants'
  | 'travaux_majeurs'
  | 'modification_reglement'
  | 'vente_parties_communes'
  | 'mandats'
  | 'autre';

export type MotionStatus = 
  | 'pending'      // En attente de vote
  | 'voting'       // Vote en cours
  | 'voted'        // Vote terminé
  | 'adopted'      // Adopté
  | 'rejected'     // Rejeté
  | 'deferred'     // Reporté
  | 'withdrawn';   // Retiré

export type AttendanceType = 'present' | 'represented' | 'absent';
export type SignatureType = 'physical' | 'electronic';

export type ProxyType = 
  | 'full'         // Pouvoir complet
  | 'partial'      // Pouvoir partiel
  | 'imperative';  // Pouvoir impératif

export type ProxyStatus = 'pending' | 'validated' | 'used' | 'cancelled' | 'expired';

export type VoteValue = 'pour' | 'contre' | 'abstention';

export type AssemblyDocumentType = 
  | 'convocation'
  | 'ordre_du_jour'
  | 'projet_resolution'
  | 'rapport_syndic'
  | 'rapport_financier'
  | 'devis'
  | 'feuille_presence'
  | 'pouvoir'
  | 'pv_draft'
  | 'pv_final'
  | 'annexe'
  | 'autre';

// =====================================================
// ASSEMBLÉES
// =====================================================

export interface Assembly {
  id: string;
  site_id: string;
  assembly_number: string;
  label: string;
  assembly_type: AssemblyType;
  scheduled_at: string;
  convocation_sent_at: string | null;
  started_at: string | null;
  ended_at: string | null;
  location_type: LocationType;
  location_address: string | null;
  location_room: string | null;
  video_link: string | null;
  video_password: string | null;
  total_tantiemes: number;
  present_tantiemes: number;
  represented_tantiemes: number;
  absent_tantiemes: number;
  quorum_required: number;
  quorum_reached: boolean;
  quorum_reached_at: string | null;
  president_name: string | null;
  president_unit_id: string | null;
  president_profile_id: string | null;
  secretary_name: string | null;
  secretary_unit_id: string | null;
  secretary_profile_id: string | null;
  scrutineer_name: string | null;
  scrutineer_unit_id: string | null;
  scrutineer_profile_id: string | null;
  status: AssemblyStatus;
  convocation_document_id: string | null;
  pv_document_id: string | null;
  pv_signed_at: string | null;
  notes: string | null;
  agenda: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface AssemblySummary extends Assembly {
  site_name: string;
  motions_count: number;
  motions_adopted: number;
  present_count: number;
  represented_count: number;
  proxies_count: number;
}

// =====================================================
// RÉSOLUTIONS (MOTIONS)
// =====================================================

export interface Motion {
  id: string;
  assembly_id: string;
  motion_number: number;
  title: string;
  description: string | null;
  majority_type: MajorityType;
  required_percentage: number | null;
  category: MotionCategory;
  associated_amount: number | null;
  associated_description: string | null;
  votes_pour: number;
  votes_contre: number;
  votes_abstention: number;
  tantiemes_pour: number;
  tantiemes_contre: number;
  tantiemes_abstention: number;
  is_adopted: boolean | null;
  adoption_percentage: number | null;
  status: MotionStatus;
  voted_at: string | null;
  display_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MotionWithResults extends Motion {
  assembly_label: string;
  assembly_date: string;
  percentage_pour: number;
}

// =====================================================
// PRÉSENCES
// =====================================================

export interface AssemblyAttendance {
  id: string;
  assembly_id: string;
  unit_id: string;
  owner_profile_id: string | null;
  owner_name: string;
  tantiemes: number;
  attendance_type: AttendanceType;
  represented_by_profile_id: string | null;
  represented_by_name: string | null;
  proxy_id: string | null;
  signed_at: string | null;
  signature_type: SignatureType | null;
  arrived_at: string | null;
  left_at: string | null;
  left_early: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// POUVOIRS
// =====================================================

export interface Proxy {
  id: string;
  assembly_id: string;
  grantor_unit_id: string;
  grantor_profile_id: string | null;
  grantor_name: string;
  grantor_tantiemes: number;
  grantee_profile_id: string | null;
  grantee_name: string;
  grantee_email: string | null;
  grantee_is_syndic: boolean;
  proxy_type: ProxyType;
  voting_instructions: Record<string, VoteValue>;
  status: ProxyStatus;
  document_id: string | null;
  signed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// =====================================================
// VOTES
// =====================================================

export interface Vote {
  id: string;
  motion_id: string;
  assembly_id: string;
  unit_id: string;
  voter_profile_id: string | null;
  voter_name: string;
  is_proxy_vote: boolean;
  proxy_id: string | null;
  tantiemes: number;
  vote_value: VoteValue;
  voted_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =====================================================
// DOCUMENTS
// =====================================================

export interface AssemblyDocument {
  id: string;
  assembly_id: string;
  document_type: AssemblyDocumentType;
  label: string;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  display_order: number;
  is_public: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  uploaded_by: string | null;
}

// =====================================================
// CALCULS
// =====================================================

export interface QuorumResult {
  total_tantiemes: number;
  present_tantiemes: number;
  represented_tantiemes: number;
  absent_tantiemes: number;
  quorum_percentage: number;
  quorum_required: number;
  quorum_reached: boolean;
}

export interface MotionResult {
  votes_pour: number;
  votes_contre: number;
  votes_abstention: number;
  tantiemes_pour: number;
  tantiemes_contre: number;
  tantiemes_abstention: number;
  total_votants: number;
  total_tantiemes_votants: number;
  percentage_pour: number;
  majority_type: MajorityType;
  required_percentage: number;
  is_adopted: boolean;
  adoption_reason: string;
}

// =====================================================
// FORMULAIRES & INPUT
// =====================================================

export interface CreateAssemblyInput {
  site_id: string;
  label: string;
  assembly_type: AssemblyType;
  scheduled_at: string;
  location_type?: LocationType;
  location_address?: string;
  location_room?: string;
  video_link?: string;
  video_password?: string;
  quorum_required?: number;
  agenda?: string;
  notes?: string;
}

export interface UpdateAssemblyInput extends Partial<CreateAssemblyInput> {
  id: string;
  president_name?: string;
  president_unit_id?: string;
  secretary_name?: string;
  secretary_unit_id?: string;
  scrutineer_name?: string;
  scrutineer_unit_id?: string;
}

export interface CreateMotionInput {
  assembly_id: string;
  motion_number: number;
  title: string;
  description?: string;
  majority_type: MajorityType;
  category?: MotionCategory;
  associated_amount?: number;
  associated_description?: string;
}

export interface CreateProxyInput {
  assembly_id: string;
  grantor_unit_id: string;
  grantor_name: string;
  grantor_tantiemes: number;
  grantee_name: string;
  grantee_email?: string;
  grantee_profile_id?: string;
  grantee_is_syndic?: boolean;
  proxy_type?: ProxyType;
  voting_instructions?: Record<string, VoteValue>;
}

export interface CreateAttendanceInput {
  assembly_id: string;
  unit_id: string;
  owner_name: string;
  tantiemes: number;
  attendance_type: AttendanceType;
  represented_by_name?: string;
  represented_by_profile_id?: string;
  proxy_id?: string;
}

export interface CastVoteInput {
  motion_id: string;
  assembly_id: string;
  unit_id: string;
  voter_name: string;
  tantiemes: number;
  vote_value: VoteValue;
  is_proxy_vote?: boolean;
  proxy_id?: string;
}

// =====================================================
// UI HELPERS
// =====================================================

export const ASSEMBLY_TYPE_LABELS: Record<AssemblyType, string> = {
  AGO: 'Assemblée Générale Ordinaire',
  AGE: 'Assemblée Générale Extraordinaire',
  AGM: 'Assemblée Générale Mixte',
};

export const ASSEMBLY_TYPE_SHORT: Record<AssemblyType, string> = {
  AGO: 'AGO',
  AGE: 'AGE',
  AGM: 'AGM',
};

export const ASSEMBLY_STATUS_LABELS: Record<AssemblyStatus, string> = {
  draft: 'Brouillon',
  convoked: 'Convoquée',
  in_progress: 'En cours',
  suspended: 'Suspendue',
  closed: 'Clôturée',
  cancelled: 'Annulée',
};

export const ASSEMBLY_STATUS_COLORS: Record<AssemblyStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  convoked: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-orange-100 text-orange-800',
  closed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const MAJORITY_TYPE_LABELS: Record<MajorityType, string> = {
  simple: 'Majorité simple (Art. 24)',
  absolute: 'Majorité absolue (Art. 25)',
  double: 'Double majorité (Art. 26)',
  unanimity: 'Unanimité',
};

export const MAJORITY_TYPE_DESCRIPTIONS: Record<MajorityType, string> = {
  simple: 'Majorité des voix exprimées des copropriétaires présents ou représentés',
  absolute: 'Majorité des voix de tous les copropriétaires',
  double: 'Majorité des copropriétaires + 2/3 des tantièmes',
  unanimity: 'Accord de tous les copropriétaires',
};

export const MOTION_CATEGORY_LABELS: Record<MotionCategory, string> = {
  general: 'Gestion courante',
  budget: 'Budget prévisionnel',
  travaux_courants: 'Travaux d\'entretien',
  travaux_majeurs: 'Gros travaux',
  modification_reglement: 'Modification du règlement',
  vente_parties_communes: 'Vente parties communes',
  mandats: 'Désignation de mandataires',
  autre: 'Autre',
};

export const MOTION_STATUS_LABELS: Record<MotionStatus, string> = {
  pending: 'En attente',
  voting: 'Vote en cours',
  voted: 'Voté',
  adopted: 'Adopté',
  rejected: 'Rejeté',
  deferred: 'Reporté',
  withdrawn: 'Retiré',
};

export const MOTION_STATUS_COLORS: Record<MotionStatus, string> = {
  pending: 'bg-gray-100 text-gray-800',
  voting: 'bg-blue-100 text-blue-800',
  voted: 'bg-purple-100 text-purple-800',
  adopted: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  deferred: 'bg-orange-100 text-orange-800',
  withdrawn: 'bg-gray-100 text-gray-500',
};

export const ATTENDANCE_TYPE_LABELS: Record<AttendanceType, string> = {
  present: 'Présent',
  represented: 'Représenté',
  absent: 'Absent',
};

export const PROXY_TYPE_LABELS: Record<ProxyType, string> = {
  full: 'Pouvoir complet',
  partial: 'Pouvoir partiel',
  imperative: 'Pouvoir impératif',
};

export const VOTE_VALUE_LABELS: Record<VoteValue, string> = {
  pour: 'Pour',
  contre: 'Contre',
  abstention: 'Abstention',
};

export const VOTE_VALUE_COLORS: Record<VoteValue, string> = {
  pour: 'bg-green-500',
  contre: 'bg-red-500',
  abstention: 'bg-gray-400',
};

export const DOCUMENT_TYPE_LABELS: Record<AssemblyDocumentType, string> = {
  convocation: 'Convocation',
  ordre_du_jour: 'Ordre du jour',
  projet_resolution: 'Projet de résolution',
  rapport_syndic: 'Rapport du syndic',
  rapport_financier: 'Rapport financier',
  devis: 'Devis',
  feuille_presence: 'Feuille de présence',
  pouvoir: 'Modèle de pouvoir',
  pv_draft: 'PV (brouillon)',
  pv_final: 'PV signé',
  annexe: 'Annexe',
  autre: 'Autre',
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function getDefaultMajorityForCategory(category: MotionCategory): MajorityType {
  switch (category) {
    case 'general':
    case 'budget':
    case 'travaux_courants':
    case 'mandats':
      return 'simple';
    case 'travaux_majeurs':
    case 'modification_reglement':
      return 'absolute';
    case 'vente_parties_communes':
      return 'double';
    default:
      return 'simple';
  }
}

export function formatQuorumPercentage(quorum: QuorumResult): string {
  return `${quorum.quorum_percentage.toFixed(2)}% (${quorum.present_tantiemes + quorum.represented_tantiemes} / ${quorum.total_tantiemes} tantièmes)`;
}

export function formatVoteResult(result: MotionResult): string {
  const total = result.tantiemes_pour + result.tantiemes_contre;
  if (total === 0) return '0%';
  return `${result.percentage_pour.toFixed(2)}% pour`;
}

export function canVoteOnMotion(motion: Motion, assembly: Assembly): boolean {
  return (
    motion.status === 'pending' &&
    assembly.status === 'in_progress' &&
    assembly.quorum_reached
  );
}

export function getRequiredPercentageForMajority(
  majorityType: MajorityType,
  totalTantiemes: number
): number {
  switch (majorityType) {
    case 'simple':
      return 50.01;
    case 'absolute':
      return 50.01;
    case 'double':
      return 66.67;
    case 'unanimity':
      return 100;
    default:
      return 50.01;
  }
}

export function generateAssemblyNumber(
  assemblyType: AssemblyType,
  year: number,
  sequence: number
): string {
  return `${assemblyType}-${year}-${sequence.toString().padStart(2, '0')}`;
}

