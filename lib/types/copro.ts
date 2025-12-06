// =====================================================
// Types TypeScript pour le module COPRO
// =====================================================

// =====================================================
// TYPES DE BASE
// =====================================================

export type SiteType = 'copropriete' | 'lotissement' | 'residence_mixte' | 'asl' | 'aful';
export type SyndicType = 'professionnel' | 'benevole' | 'cooperatif';
export type BuildingType = 'immeuble' | 'maison' | 'parking' | 'local_commercial' | 'autre';
export type HeatingType = 'collectif' | 'individuel' | 'mixte' | 'aucun';
export type WaterType = 'collectif' | 'individuel' | 'compteurs_divisionnaires';

export type UnitType = 
  | 'appartement' | 'maison' | 'studio' | 'duplex' | 'triplex'
  | 'local_commercial' | 'bureau'
  | 'cave' | 'parking' | 'box' | 'garage'
  | 'jardin' | 'terrasse' | 'balcon'
  | 'local_technique' | 'loge_gardien'
  | 'autre';

export type OccupationMode = 'owner_occupied' | 'rented' | 'vacant' | 'secondary';
export type OwnershipType = 'pleine_propriete' | 'nue_propriete' | 'usufruit' | 'indivision' | 'sci' | 'autre';
export type TransferType = 'vente' | 'donation' | 'heritage' | 'division' | 'fusion' | 'autre';

export type RepartitionKey = 
  | 'general' | 'eau' | 'chauffage' | 'ascenseur'
  | 'ordures' | 'eclairage' | 'espaces_verts'
  | 'parking' | 'interphone' | 'antenne'
  | 'custom_1' | 'custom_2' | 'custom_3';

// =====================================================
// STRUCTURE PHYSIQUE
// =====================================================

export interface Site {
  id: string;
  tenant_id: string | null;
  name: string;
  code: string | null;
  type: SiteType;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  siret: string | null;
  numero_immatriculation: string | null;
  date_reglement: string | null;
  bank_account_id: string | null;
  iban: string | null;
  bic: string | null;
  fiscal_year_start_month: number;
  total_tantiemes_general: number;
  total_tantiemes_eau: number;
  total_tantiemes_chauffage: number;
  total_tantiemes_ascenseur: number;
  syndic_type: SyndicType;
  syndic_profile_id: string | null;
  syndic_company_name: string | null;
  syndic_siret: string | null;
  syndic_address: string | null;
  syndic_email: string | null;
  syndic_phone: string | null;
  is_active: boolean;
  archived_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface Building {
  id: string;
  site_id: string;
  tenant_id: string | null;
  name: string;
  code: string | null;
  building_type: BuildingType;
  address_line1: string | null;
  address_line2: string | null;
  floors_count: number;
  has_basement: boolean;
  basement_levels: number;
  has_elevator: boolean;
  elevator_count: number;
  construction_year: number | null;
  renovation_year: number | null;
  heating_type: HeatingType | null;
  water_type: WaterType | null;
  display_order: number;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Floor {
  id: string;
  building_id: string;
  level: number;
  name: string | null;
  display_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CoproUnit {
  id: string;
  site_id: string;
  building_id: string | null;
  floor_id: string | null;
  lot_number: string;
  lot_suffix: string | null;
  cadastral_reference: string | null;
  unit_type: UnitType;
  surface_carrez: number | null;
  surface_habitable: number | null;
  surface_utile: number | null;
  rooms_count: number;
  floor_level: number | null;
  door_number: string | null;
  staircase: string | null;
  position: string | null;
  tantieme_general: number;
  tantieme_eau: number;
  tantieme_chauffage: number;
  tantieme_ascenseur: number;
  occupation_mode: OccupationMode;
  linked_property_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CoproLot {
  id: string;
  unit_id: string;
  repartition_key: RepartitionKey;
  repartition_key_label: string | null;
  tantiemes: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Ownership {
  id: string;
  unit_id: string;
  profile_id: string;
  ownership_type: OwnershipType;
  ownership_share: number;
  acquisition_date: string | null;
  acquisition_type: string | null;
  end_date: string | null;
  can_vote: boolean;
  vote_delegation_to: string | null;
  is_current: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OwnershipHistory {
  id: string;
  unit_id: string;
  previous_owner_id: string | null;
  previous_ownership_share: number | null;
  new_owner_id: string | null;
  new_ownership_share: number | null;
  transfer_type: TransferType;
  transfer_date: string;
  transfer_price: number | null;
  notary_name: string | null;
  notary_reference: string | null;
  deed_document_id: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// =====================================================
// VUES ENRICHIES
// =====================================================

export interface CoproUnitWithDetails extends CoproUnit {
  building_name: string | null;
  building_type: BuildingType | null;
  floor_level_name: number | null;
  floor_name: string | null;
  site_name: string;
  total_tantiemes_general: number;
  percentage_general: number;
  all_tantiemes: Record<RepartitionKey, number>;
}

export interface CurrentOwnership extends Ownership {
  lot_number: string;
  unit_type: UnitType;
  tantieme_general: number;
  surface_carrez: number | null;
  owner_first_name: string;
  owner_last_name: string;
  owner_email: string;
  site_id: string;
  site_name: string;
}

export interface SiteStructure {
  site_id: string;
  site_name: string;
  site_type: SiteType;
  building_id: string | null;
  building_name: string | null;
  building_type: BuildingType | null;
  floor_id: string | null;
  floor_level: number | null;
  floor_name: string | null;
  unit_id: string | null;
  lot_number: string | null;
  unit_type: UnitType | null;
  tantieme_general: number | null;
  occupation_mode: OccupationMode | null;
}

// =====================================================
// RBAC
// =====================================================

export type RoleCategory = 'platform' | 'copro' | 'locatif' | 'prestataire';

export type RoleCode =
  | 'platform_admin'
  | 'syndic'
  | 'conseil_syndical'
  | 'president_cs'
  | 'coproprietaire_occupant'
  | 'coproprietaire_bailleur'
  | 'coproprietaire_nu'
  | 'usufruitier'
  | 'locataire'
  | 'occupant'
  | 'prestataire'
  | 'gardien';

export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'manage' | 'admin';

export type PermissionCode =
  // Platform
  | 'platform.admin'
  | 'platform.users.manage'
  | 'platform.billing.manage'
  // Sites
  | 'sites.create' | 'sites.read' | 'sites.read_own' | 'sites.update' | 'sites.delete' | 'sites.manage'
  // Buildings/Units
  | 'buildings.manage' | 'units.read' | 'units.read_own' | 'units.manage' | 'tantiemes.manage'
  // Owners
  | 'owners.read' | 'owners.manage' | 'owners.invite'
  // Charges
  | 'charges.read' | 'charges.read_own' | 'charges.manage' | 'charges.allocate' | 'charges.validate'
  // Services
  | 'services.read' | 'services.manage' | 'contracts.read' | 'contracts.manage'
  | 'expenses.create' | 'expenses.manage'
  // Calls
  | 'calls.read' | 'calls.read_own' | 'calls.manage' | 'calls.send'
  // Payments
  | 'payments.read' | 'payments.read_own' | 'payments.create' | 'payments.manage'
  // Assemblies
  | 'assemblies.read' | 'assemblies.manage' | 'assemblies.convoke' | 'assemblies.vote' | 'assemblies.proxy'
  // Documents
  | 'documents.read' | 'documents.read_own' | 'documents.manage' | 'documents.upload'
  // Tickets
  | 'tickets.read' | 'tickets.read_own' | 'tickets.create' | 'tickets.manage'
  // Locatif
  | 'locatif.charges.read' | 'locatif.charges.manage' | 'locatif.regularisation'
  // Accounting
  | 'accounting.read' | 'accounting.manage'
  // Reports
  | 'reports.read' | 'reports.export';

export interface AppRole {
  id: string;
  code: RoleCode;
  label: string;
  description: string | null;
  category: RoleCategory;
  parent_role_code: RoleCode | null;
  hierarchy_level: number;
  is_system: boolean;
  is_assignable: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AppPermission {
  id: string;
  code: PermissionCode;
  label: string;
  description: string | null;
  module: string;
  action: PermissionAction;
  created_at: string;
}

export interface RolePermission {
  id: string;
  role_code: RoleCode;
  permission_code: PermissionCode;
  conditions: Record<string, unknown>;
  created_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role_code: RoleCode;
  tenant_id: string | null;
  site_id: string | null;
  unit_id: string | null;
  granted_at: string;
  granted_by: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserRoleDetailed extends UserRole {
  role_label: string;
  role_category: RoleCategory;
  hierarchy_level: number;
  site_name: string | null;
  lot_number: string | null;
}

export interface UserPermission {
  user_id: string;
  site_id: string | null;
  unit_id: string | null;
  permission_code: PermissionCode;
  module: string;
  action: PermissionAction;
  permission_label: string;
}

// =====================================================
// INVITATIONS
// =====================================================

export type InviteTargetRole = 
  | 'syndic' | 'conseil_syndical' | 'president_cs'
  | 'coproprietaire_occupant' | 'coproprietaire_bailleur'
  | 'coproprietaire_nu' | 'usufruitier'
  | 'locataire' | 'gardien' | 'prestataire';

export type InviteStatus = 'pending' | 'sent' | 'accepted' | 'expired' | 'cancelled';

export interface CoproInvite {
  id: string;
  token: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  site_id: string;
  unit_id: string | null;
  target_role: InviteTargetRole;
  ownership_type: OwnershipType | null;
  ownership_share: number;
  personal_message: string | null;
  invited_by: string;
  status: InviteStatus;
  sent_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  expires_at: string;
  reminder_count: number;
  last_reminder_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface InviteValidationResult {
  is_valid: boolean;
  invite_id: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  site_id: string | null;
  site_name: string | null;
  unit_id: string | null;
  lot_number: string | null;
  target_role: InviteTargetRole | null;
  ownership_type: OwnershipType | null;
  ownership_share: number | null;
  error_message: string | null;
}

export interface InviteAcceptResult {
  success: boolean;
  invite_id: string | null;
  role_assigned: RoleCode | null;
  ownership_created: boolean;
  error_message: string | null;
}

// =====================================================
// FORMULAIRES & INPUT
// =====================================================

export interface CreateSiteInput {
  name: string;
  type: SiteType;
  address_line1: string;
  address_line2?: string;
  postal_code: string;
  city: string;
  country?: string;
  siret?: string;
  numero_immatriculation?: string;
  date_reglement?: string;
  fiscal_year_start_month?: number;
  total_tantiemes_general?: number;
  syndic_type?: SyndicType;
  syndic_company_name?: string;
  syndic_siret?: string;
  syndic_address?: string;
  syndic_email?: string;
  syndic_phone?: string;
}

export interface UpdateSiteInput extends Partial<CreateSiteInput> {
  id: string;
}

export interface CreateBuildingInput {
  site_id: string;
  name: string;
  code?: string;
  building_type?: BuildingType;
  address_line1?: string;
  address_line2?: string;
  floors_count?: number;
  has_basement?: boolean;
  basement_levels?: number;
  has_elevator?: boolean;
  elevator_count?: number;
  construction_year?: number;
  heating_type?: HeatingType;
  water_type?: WaterType;
  display_order?: number;
}

export interface CreateUnitInput {
  site_id: string;
  building_id?: string;
  floor_id?: string;
  lot_number: string;
  lot_suffix?: string;
  unit_type: UnitType;
  surface_carrez?: number;
  surface_habitable?: number;
  rooms_count?: number;
  floor_level?: number;
  door_number?: string;
  staircase?: string;
  tantieme_general: number;
  tantieme_eau?: number;
  tantieme_chauffage?: number;
  tantieme_ascenseur?: number;
}

export interface CreateInviteInput {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  site_id: string;
  unit_id?: string;
  target_role: InviteTargetRole;
  ownership_type?: OwnershipType;
  ownership_share?: number;
  personal_message?: string;
}

export interface BatchInviteInput {
  site_id: string;
  invites: CreateInviteInput[];
  send_emails: boolean;
}

// =====================================================
// UI HELPERS
// =====================================================

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  copropriete: 'Copropriété',
  lotissement: 'Lotissement',
  residence_mixte: 'Résidence mixte',
  asl: 'ASL (Association Syndicale Libre)',
  aful: 'AFUL (Association Foncière Urbaine Libre)',
};

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  immeuble: 'Immeuble',
  maison: 'Maison',
  parking: 'Parking',
  local_commercial: 'Local commercial',
  autre: 'Autre',
};

export const UNIT_TYPE_LABELS: Record<UnitType, string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  studio: 'Studio',
  duplex: 'Duplex',
  triplex: 'Triplex',
  local_commercial: 'Local commercial',
  bureau: 'Bureau',
  cave: 'Cave',
  parking: 'Parking',
  box: 'Box',
  garage: 'Garage',
  jardin: 'Jardin',
  terrasse: 'Terrasse',
  balcon: 'Balcon',
  local_technique: 'Local technique',
  loge_gardien: 'Loge gardien',
  autre: 'Autre',
};

export const OCCUPATION_MODE_LABELS: Record<OccupationMode, string> = {
  owner_occupied: 'Propriétaire occupant',
  rented: 'Loué',
  vacant: 'Vacant',
  secondary: 'Résidence secondaire',
};

export const ROLE_LABELS: Record<RoleCode, string> = {
  platform_admin: 'Administrateur plateforme',
  syndic: 'Syndic',
  conseil_syndical: 'Membre du Conseil Syndical',
  president_cs: 'Président du Conseil Syndical',
  coproprietaire_occupant: 'Copropriétaire occupant',
  coproprietaire_bailleur: 'Copropriétaire bailleur',
  coproprietaire_nu: 'Nu-propriétaire',
  usufruitier: 'Usufruitier',
  locataire: 'Locataire',
  occupant: 'Occupant',
  prestataire: 'Prestataire',
  gardien: 'Gardien/Concierge',
};

export const OWNERSHIP_TYPE_LABELS: Record<OwnershipType, string> = {
  pleine_propriete: 'Pleine propriété',
  nue_propriete: 'Nue-propriété',
  usufruit: 'Usufruit',
  indivision: 'Indivision',
  sci: 'SCI',
  autre: 'Autre',
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function getFloorLabel(level: number): string {
  if (level < 0) return `Sous-sol ${Math.abs(level)}`;
  if (level === 0) return 'Rez-de-chaussée';
  if (level === 1) return '1er étage';
  return `${level}ème étage`;
}

export function formatTantiemes(tantiemes: number, total: number = 10000): string {
  const percentage = ((tantiemes / total) * 100).toFixed(2);
  return `${tantiemes.toLocaleString()} millièmes (${percentage}%)`;
}

export function calculatePercentage(tantiemes: number, total: number = 10000): number {
  if (total === 0) return 0;
  return Math.round((tantiemes / total) * 10000) / 100;
}

