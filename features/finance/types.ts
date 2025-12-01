export type BankConnectionStatus = "created" | "linked" | "expired" | "error";

export interface BankConnection {
  id: string;
  institution_id: string;
  institution_name: string;
  institution_logo?: string;
  status: BankConnectionStatus;
  last_synced_at?: string;
  accounts?: BankAccountMetadata[];
  created_at: string;
}

export interface BankAccountMetadata {
  id: string;
  iban?: string;
  name?: string;
  currency?: string;
  balance?: number;
}

export interface BankTransaction {
  id: string;
  booking_date: string;
  amount: number;
  currency: string;
  description: string;
  category?: string;
  status: "pending" | "matched" | "ignored" | "manual";
  match_confidence_score?: number;
  matched_invoice_id?: string;
}

export interface CreateConnectionResponse {
  link: string; // URL de redirection vers la banque (GoCardless)
  requisition_id: string;
}

