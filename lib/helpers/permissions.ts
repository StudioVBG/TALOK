import type { UserRole } from "@/lib/types";

// Helpers pour vérifier les permissions

export function canAccessAdmin(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "platform_admin";
}

export function canManageProperties(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner" || userRole === "agency";
}

export function canViewProperties(userRole: UserRole | null | undefined): boolean {
  return (
    userRole === "admin" ||
    userRole === "owner" ||
    userRole === "tenant" ||
    userRole === "agency"
  );
}

export function canManageLeases(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner" || userRole === "agency";
}

export function canManageTickets(userRole: UserRole | null | undefined): boolean {
  return (
    userRole === "admin" ||
    userRole === "owner" ||
    userRole === "tenant" ||
    userRole === "agency"
  );
}

export function canManageWorkOrders(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "provider" || userRole === "agency";
}

export function canManageInvoices(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "owner" || userRole === "agency";
}

export function canViewInvoices(userRole: UserRole | null | undefined): boolean {
  return (
    userRole === "admin" ||
    userRole === "owner" ||
    userRole === "tenant" ||
    userRole === "agency"
  );
}

export function canManageMandates(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "agency";
}

export function canManageAgencyTeam(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin" || userRole === "agency";
}

export function canManageBlog(userRole: UserRole | null | undefined): boolean {
  return userRole === "admin";
}

