"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationCenter } from "@/components/notifications/notification-center";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import {
  User,
  Settings,
  LogOut,
  HelpCircle,
  MessageSquare,
} from "lucide-react";
import { authService } from "@/features/auth/services/auth.service";

interface AppHeaderProps {
  profile: {
    id?: string;
    prenom?: string | null;
    nom?: string | null;
    avatar_url?: string | null;
    role?: string;
  };
  role: "owner" | "tenant" | "provider" | "syndic";
}

const ROLE_CONFIG = {
  owner: {
    label: "Propriétaire",
    profilePath: "/owner/profile",
    settingsPath: "/owner/settings",
    messagesPath: "/owner/messages",
    supportPath: "/owner/support",
  },
  tenant: {
    label: "Locataire",
    profilePath: "/tenant/settings",
    settingsPath: "/tenant/settings",
    messagesPath: "/tenant/messages",
    supportPath: "/tenant/help",
  },
  provider: {
    label: "Prestataire",
    profilePath: "/provider/profile",
    settingsPath: "/provider/settings",
    messagesPath: "/provider/messages",
    supportPath: "/provider/help",
  },
  syndic: {
    label: "Syndic",
    profilePath: "/syndic/profile",
    settingsPath: "/syndic/settings",
    messagesPath: "/syndic/messages",
    supportPath: "/syndic/help",
  },
};

export function AppHeader({ profile, role }: AppHeaderProps) {
  const router = useRouter();
  const config = ROLE_CONFIG[role];

  const handleSignOut = async () => {
    await authService.signOut();
    router.push("/auth/signin");
  };

  const initials = [profile.prenom?.[0], profile.nom?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U";

  const fullName = [profile.prenom, profile.nom].filter(Boolean).join(" ") || "Utilisateur";

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-slate-200 bg-white/80 backdrop-blur-sm px-4 sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch items-center justify-end lg:gap-x-6">
        {/* Actions de droite */}
        <div className="flex items-center gap-x-2 lg:gap-x-4">
          {/* Messages */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            asChild
          >
            <Link href={config.messagesPath}>
              <MessageSquare className="h-5 w-5" />
            </Link>
          </Button>

          {/* Notifications */}
          <NotificationCenter />

          {/* Dark mode toggle */}
          <DarkModeToggle />

          {/* Separator */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-slate-200" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="flex items-center gap-x-2 p-1.5"
              >
                <Avatar className="h-8 w-8">
                  {profile.avatar_url && (
                    <AvatarImage src={profile.avatar_url} alt={fullName} />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden lg:flex lg:items-center">
                  <span className="text-sm font-semibold leading-6 text-slate-900">
                    {fullName}
                  </span>
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{fullName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {config.label}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={config.profilePath} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  Mon profil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={config.settingsPath} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  Paramètres
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={config.supportPath} className="cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Aide
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-red-600 cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Déconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

