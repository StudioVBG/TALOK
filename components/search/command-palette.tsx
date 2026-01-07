"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Home,
  FileText,
  Users,
  Receipt,
  Settings,
  HelpCircle,
  Plus,
  Search,
  Building2,
  Ticket,
  FolderOpen,
  BarChart3,
  LogOut,
  Moon,
  Sun,
  Calculator,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface CommandPaletteProps {
  userRole?: "owner" | "tenant" | "admin" | "provider";
}

interface CommandItem {
  id: string;
  label: string;
  icon: typeof Home;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
  group: string;
}

/**
 * Palette de commandes (Cmd+K / Ctrl+K)
 * 
 * Permet une navigation rapide dans l'application
 */
export function CommandPalette({ userRole = "owner" }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Raccourci clavier Cmd+K / Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      router.push(path);
    },
    [router]
  );

  // Commandes communes
  const commonCommands: CommandItem[] = useMemo(
    () => [
      {
        id: "search",
        label: "Rechercher...",
        icon: Search,
        action: () => {},
        keywords: ["chercher", "find"],
        group: "general",
      },
      {
        id: "help",
        label: "Aide & Support",
        icon: HelpCircle,
        shortcut: "?",
        action: () => navigate("/help"),
        keywords: ["aide", "support", "faq"],
        group: "general",
      },
      {
        id: "settings",
        label: "Paramètres",
        icon: Settings,
        shortcut: "⌘,",
        action: () => navigate("/settings"),
        keywords: ["configuration", "préférences"],
        group: "general",
      },
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Mode clair" : "Mode sombre",
        icon: theme === "dark" ? Sun : Moon,
        action: () => setTheme(theme === "dark" ? "light" : "dark"),
        keywords: ["thème", "dark", "light", "apparence"],
        group: "general",
      },
      {
        id: "logout",
        label: "Déconnexion",
        icon: LogOut,
        action: () => navigate("/auth/signout"),
        keywords: ["sortir", "quitter"],
        group: "general",
      },
    ],
    [navigate, theme, setTheme]
  );

  // Commandes propriétaire
  const ownerCommands: CommandItem[] = useMemo(
    () => [
      {
        id: "owner-dashboard",
        label: "Tableau de bord",
        icon: BarChart3,
        shortcut: "⌘D",
        action: () => navigate("/owner/dashboard"),
        keywords: ["accueil", "home", "dashboard"],
        group: "navigation",
      },
      {
        id: "owner-properties",
        label: "Mes biens",
        icon: Building2,
        shortcut: "⌘B",
        action: () => navigate("/owner/properties"),
        keywords: ["logements", "appartements", "maisons"],
        group: "navigation",
      },
      {
        id: "owner-contracts",
        label: "Contrats",
        icon: FileText,
        shortcut: "⌘C",
        action: () => navigate("/owner/leases"),
        keywords: ["baux", "leases"],
        group: "navigation",
      },
      {
        id: "owner-money",
        label: "Finances",
        icon: Receipt,
        shortcut: "⌘F",
        action: () => navigate("/owner/money"),
        keywords: ["factures", "paiements", "loyers"],
        group: "navigation",
      },
      {
        id: "owner-documents",
        label: "Documents",
        icon: FolderOpen,
        action: () => navigate("/owner/documents"),
        keywords: ["fichiers", "pdf"],
        group: "navigation",
      },
      {
        id: "owner-tickets",
        label: "Maintenance",
        icon: Ticket,
        action: () => navigate("/owner/tickets"),
        keywords: ["demandes", "travaux", "réparations"],
        group: "navigation",
      },
      // Actions rapides
      {
        id: "add-property",
        label: "Ajouter un bien",
        icon: Plus,
        shortcut: "⌘N",
        action: () => navigate("/owner/properties/new"),
        keywords: ["nouveau", "créer", "logement"],
        group: "actions",
      },
      {
        id: "add-contract",
        label: "Nouveau contrat",
        icon: Plus,
        action: () => navigate("/owner/leases/new"),
        keywords: ["bail", "location"],
        group: "actions",
      },
      {
        id: "add-invoice",
        label: "Générer une facture",
        icon: Receipt,
        action: () => navigate("/owner/money/new"),
        keywords: ["quittance", "loyer"],
        group: "actions",
      },
      {
        id: "rent-calculator",
        label: "Simulateur fiscal & DROM",
        icon: Calculator,
        action: () => navigate("/owner/taxes"),
        keywords: ["simulation", "rentabilité", "impôts", "drom", "tva"],
        group: "tools",
      },
      {
        id: "owner-audit",
        label: "Journal d'audit (RGPD)",
        icon: FileText,
        action: () => navigate("/owner/audit"),
        keywords: ["logs", "sécurité", "traces", "rgpd"],
        group: "tools",
      },
    ],
    [navigate]
  );

  // Commandes locataire
  const tenantCommands: CommandItem[] = useMemo(
    () => [
      {
        id: "tenant-dashboard",
        label: "Tableau de bord",
        icon: BarChart3,
        shortcut: "⌘D",
        action: () => navigate("/tenant/dashboard"),
        keywords: ["accueil", "home"],
        group: "navigation",
      },
      {
        id: "tenant-lease",
        label: "Mon bail",
        icon: FileText,
        action: () => navigate("/tenant/lease"),
        keywords: ["contrat", "location"],
        group: "navigation",
      },
      {
        id: "tenant-payments",
        label: "Mes paiements",
        icon: Receipt,
        action: () => navigate("/tenant/payments"),
        keywords: ["loyers", "quittances"],
        group: "navigation",
      },
      {
        id: "tenant-requests",
        label: "Mes demandes",
        icon: Ticket,
        action: () => navigate("/tenant/requests"),
        keywords: ["tickets", "maintenance"],
        group: "navigation",
      },
      {
        id: "tenant-documents",
        label: "Documents",
        icon: FolderOpen,
        action: () => navigate("/tenant/documents"),
        keywords: ["fichiers"],
        group: "navigation",
      },
      {
        id: "new-request",
        label: "Nouvelle demande",
        icon: Plus,
        action: () => navigate("/tenant/requests/new"),
        keywords: ["signaler", "problème"],
        group: "actions",
      },
    ],
    [navigate]
  );

  // Commandes admin
  const adminCommands: CommandItem[] = useMemo(
    () => [
      {
        id: "admin-overview",
        label: "Vue d'ensemble",
        icon: BarChart3,
        action: () => navigate("/admin/overview"),
        keywords: ["dashboard", "stats"],
        group: "navigation",
      },
      {
        id: "admin-users",
        label: "Utilisateurs",
        icon: Users,
        action: () => navigate("/admin/people"),
        keywords: ["comptes", "membres"],
        group: "navigation",
      },
      {
        id: "admin-templates",
        label: "Modèles",
        icon: FileText,
        action: () => navigate("/admin/templates"),
        keywords: ["documents"],
        group: "navigation",
      },
      {
        id: "admin-integrations",
        label: "Intégrations",
        icon: Settings,
        action: () => navigate("/admin/integrations"),
        keywords: ["api", "connexions"],
        group: "navigation",
      },
    ],
    [navigate]
  );

  // Sélectionner les commandes selon le rôle
  const roleCommands = useMemo(() => {
    switch (userRole) {
      case "owner":
        return ownerCommands;
      case "tenant":
        return tenantCommands;
      case "admin":
        return adminCommands;
      default:
        return [];
    }
  }, [userRole, ownerCommands, tenantCommands, adminCommands]);

  const allCommands = [...roleCommands, ...commonCommands];

  // Filtrer les commandes
  const filteredCommands = useMemo(() => {
    if (!search) return allCommands;
    
    const searchLower = search.toLowerCase();
    return allCommands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(searchLower) ||
        cmd.keywords?.some((kw) => kw.toLowerCase().includes(searchLower))
    );
  }, [search, allCommands]);

  // Grouper les commandes
  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    
    filteredCommands.forEach((cmd) => {
      if (!groups[cmd.group]) {
        groups[cmd.group] = [];
      }
      groups[cmd.group].push(cmd);
    });
    
    return groups;
  }, [filteredCommands]);

  const groupLabels: Record<string, string> = {
    navigation: "Navigation",
    actions: "Actions rapides",
    tools: "Outils",
    general: "Général",
  };

  return (
    <>
      {/* Bouton de recherche */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground",
          "border rounded-lg bg-background hover:bg-accent transition-colors",
          "w-full sm:w-auto justify-start sm:justify-between"
        )}
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Rechercher...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      {/* Dialog de commandes */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Tapez une commande ou recherchez..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          
          {Object.entries(groupedCommands).map(([group, commands], index) => (
            <div key={group}>
              {index > 0 && <CommandSeparator />}
              <CommandGroup heading={groupLabels[group] || group}>
                {commands.map((cmd) => {
                  const Icon = cmd.icon;
                  return (
                    <CommandItem
                      key={cmd.id}
                      value={cmd.id}
                      onSelect={() => {
                        cmd.action();
                        if (cmd.id !== "search") {
                          setOpen(false);
                        }
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{cmd.label}</span>
                      {cmd.shortcut && (
                        <CommandShortcut>{cmd.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default CommandPalette;

