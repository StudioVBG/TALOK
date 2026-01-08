/**
 * Types pour l'Assistant IA de Talok
 * SOTA Décembre 2025 - GPT-5.1 + LangGraph
 */

import { BaseMessage } from "@langchain/core/messages";

// ============================================
// CONTEXT TYPES
// ============================================

export type UserRole = "owner" | "tenant" | "provider" | "admin";

export interface AssistantContext {
  userId: string;
  profileId: string;
  role: UserRole;
  currentPropertyId?: string;
  currentLeaseId?: string;
  currentTicketId?: string;
  locale: "fr" | "en";
}

// ============================================
// TOOL RESULT TYPES
// ============================================

export interface PropertySearchResult {
  id: string;
  title: string;
  address: string;
  city: string;
  type: string;
  surface: number;
  rent: number;
  status: "available" | "rented" | "pending";
}

export interface TenantSearchResult {
  id: string;
  name: string;
  email: string;
  phone?: string;
  propertyId?: string;
  leaseStatus?: "active" | "pending" | "ended";
  paymentStatus?: "up_to_date" | "late" | "very_late";
}

export interface PaymentSearchResult {
  id: string;
  invoiceId: string;
  amount: number;
  status: "paid" | "pending" | "late" | "very_late";
  dueDate: string;
  paidDate?: string;
  tenantName: string;
  propertyAddress: string;
}

export interface TicketSearchResult {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  createdAt: string;
  propertyAddress: string;
  tenantName?: string;
}

export interface DocumentSearchResult {
  id: string;
  type: string;
  name: string;
  uploadedAt: string;
  propertyId?: string;
  leaseId?: string;
  status?: "verified" | "pending" | "rejected";
}

// ============================================
// ACTION RESULT TYPES
// ============================================

export interface TicketCreationResult {
  success: boolean;
  ticketId?: string;
  message: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  message: string;
}

export interface DocumentGenerationResult {
  success: boolean;
  documentId?: string;
  documentUrl?: string;
  message: string;
}

export interface InvoiceCreationResult {
  success: boolean;
  invoiceId?: string;
  message: string;
}

// ============================================
// STATE TYPES
// ============================================

export interface AssistantStateType {
  // Messages
  messages: BaseMessage[];
  
  // Context
  context: AssistantContext;
  
  // Tool results (optionnel, rempli après exécution des tools)
  toolResults?: Record<string, unknown>;
  
  // Metadata
  lastToolCalled?: string;
  confidence?: number;
  requiresHumanApproval?: boolean;
  approvalType?: "signature" | "payment" | "legal" | "other";
}

// ============================================
// API TYPES
// ============================================

export interface AssistantRequest {
  message: string;
  threadId?: string;
  context?: Partial<AssistantContext>;
}

export interface AssistantResponse {
  message: string;
  threadId: string;
  toolsUsed?: string[];
  requiresAction?: boolean;
  actionType?: string;
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  type: "token" | "tool_start" | "tool_end" | "complete" | "error";
  content?: string;
  toolName?: string;
  toolResult?: unknown;
  error?: string;
}

