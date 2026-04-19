"use client";

// =====================================================
// Badge rôle dans une conversation Messages
// 4 rôles : owner | tenant | provider | admin
// Pattern aligné sur components/provider/provider-badges.tsx
// (classes Tailwind directes, wrap Badge variant="outline")
// =====================================================

import { Home, User, Wrench, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type ConversationRole = "owner" | "tenant" | "provider" | "admin";

interface RoleConfig {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const ROLE_CONFIGS: Record<ConversationRole, RoleConfig> = {
  owner: {
    icon: Home,
    label: "Propriétaire",
    color: "text-blue-700",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  tenant: {
    icon: User,
    label: "Locataire",
    color: "text-cyan-700",
    bgColor: "bg-cyan-50",
    borderColor: "border-cyan-200",
  },
  provider: {
    icon: Wrench,
    label: "Prestataire",
    color: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  admin: {
    icon: Shield,
    label: "Support Talok",
    color: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
};

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0 h-5",
  md: "text-xs px-2 py-0.5",
  lg: "text-sm px-2.5 py-1",
};

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

interface ConversationRoleBadgeProps {
  role: ConversationRole;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ConversationRoleBadge({
  role,
  showIcon = true,
  size = "md",
  className = "",
}: ConversationRoleBadgeProps) {
  const config = ROLE_CONFIGS[role];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`${config.bgColor} ${config.color} ${config.borderColor} ${sizeClasses[size]} gap-1 font-medium ${className}`}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      {config.label}
    </Badge>
  );
}
