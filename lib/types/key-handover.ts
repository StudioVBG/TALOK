/**
 * Types TypeScript pour la Remise des Clés
 * SOTA 2026
 */

export type HandoverType = "entree" | "sortie";

export type HandoverStatus = "planned" | "in_progress" | "completed" | "cancelled";

export type KeyType =
  | "porte_principale"
  | "porte_cave"
  | "porte_garage"
  | "boite_aux_lettres"
  | "portail"
  | "local_velo"
  | "local_poubelles"
  | "badge_acces"
  | "telecommande_parking"
  | "autre";

export interface KeyItem {
  type: KeyType;
  quantity: number;
  notes?: string;
}

export interface AccessCode {
  type: "digicode" | "interphone" | "portail" | "wifi" | "alarme" | "autre";
  code: string;
  location?: string;
}

export interface HandoverMeterReading {
  meter_type: "electricity" | "gas" | "water";
  value: number;
  unit: "kWh" | "m3" | "L";
  photo_path?: string;
}

export interface KeyHandover {
  id: string;
  lease_id: string;
  property_id: string;
  handover_type: HandoverType;
  keys: KeyItem[];
  access_codes: AccessCode[];
  owner_profile_id: string | null;
  tenant_profile_id: string | null;
  witness_name: string | null;
  witness_role: string | null;
  handover_date: string;
  handover_time: string | null;
  handover_location: string | null;
  meter_readings: HandoverMeterReading[];
  owner_signed: boolean;
  tenant_signed: boolean;
  owner_signed_at: string | null;
  tenant_signed_at: string | null;
  status: HandoverStatus;
  photos: Array<{ path: string; description?: string }>;
  notes: string | null;
  general_observations: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateKeyHandoverDTO {
  lease_id: string;
  handover_type: HandoverType;
  keys: KeyItem[];
  access_codes?: AccessCode[];
  handover_date: string;
  handover_time?: string;
  meter_readings?: HandoverMeterReading[];
  notes?: string;
}

export const KEY_TYPE_LABELS: Record<KeyType, string> = {
  porte_principale: "Porte principale",
  porte_cave: "Cave",
  porte_garage: "Garage",
  boite_aux_lettres: "Boîte aux lettres",
  portail: "Portail",
  local_velo: "Local vélos",
  local_poubelles: "Local poubelles",
  badge_acces: "Badge d'accès",
  telecommande_parking: "Télécommande parking",
  autre: "Autre",
};

export const HANDOVER_STATUS_LABELS: Record<HandoverStatus, string> = {
  planned: "Planifiée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};
