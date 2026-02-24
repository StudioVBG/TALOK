import type { UserRole } from "@/lib/types";

// Helpers pour vérifier les permissions

export function canAccessAdmin(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "platform_admin";
}

export function canManageProperties(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner";
}

export function canViewProperties(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner" || userRole === "tenant";
}

export function canManageLeases(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner";
}

export function canManageTickets(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner" || userRole === "tenant";
}

export function canManageWorkOrders(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "provider";
}

export function canManageInvoices(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner";
}

export function canViewInvoices(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner" || userRole === "tenant";
}

export function canManageBlog(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin";
}

