"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
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
  LayoutDashboard,
  Building2,
  FileText,
  Users,
  Euro,
  Wrench,
  FileCheck,
  ClipboardCheck,
  CalendarClock,
  HelpCircle,
  Settings,
  MessageSquare,
  Calculator,
  Plus,
  Search,
  Home,
  Bell,
  LogOut,
  Moon,
  Sun,
  Sparkles,
  Zap,
  CreditCard,
  UserCircle,
  Mail,
  Phone,
  Globe,
  Loader2,
  MapPin,
  User,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useDebounce } from "@/lib/hooks/use-debounce";

interface CommandPaletteProps {
  role?: "owner" | "tenant" | "admin";
}

// Définition des commandes pour chaque rôle
const ownerCommands = {
  navigation: [
    { icon: LayoutDashboard, label: "Tableau de bord", href: "/owner/dashboard", shortcut: "⌘D" },
    { icon: Building2, label: "Mes biens", href: "/owner/properties", shortcut: "⌘B" },
    { icon: Users, label: "Mes locataires", href: "/owner/tenants", shortcut: "⌘L" },
    { icon: FileText, label: "Baux & contrats", href: "/owner/leases", shortcut: "⌘C" },
    { icon: Euro, label: "Loyers & revenus", href: "/owner/money", shortcut: "⌘M" },
    { icon: Wrench, label: "Tickets maintenance", href: "/owner/tickets" },
    { icon: ClipboardCheck, label: "États des lieux", href: "/owner/inspections" },
    { icon: FileCheck, label: "Documents", href: "/owner/documents" },
    { icon: MessageSquare, label: "Messages", href: "/owner/messages" },
    { icon: Calculator, label: "Fiscalité", href: "/owner/taxes" },
  ],
  actions: [
    { icon: Plus, label: "Ajouter un bien", href: "/owner/properties/new", accent: true },
    { icon: Plus, label: "Créer un bail", href: "/owner/leases/new", accent: true },
    { icon: Plus, label: "Nouveau ticket", href: "/owner/tickets/new" },
    { icon: Plus, label: "Nouvel état des lieux", href: "/owner/inspections/new" },
    { icon: CreditCard, label: "Générer les factures", href: "/owner/money?action=generate" },
  ],
  settings: [
    { icon: UserCircle, label: "Mon profil", href: "/owner/profile" },
    { icon: CreditCard, label: "Abonnement & facturation", href: "/owner/settings/billing" },
    { icon: Bell, label: "Notifications", href: "/owner/settings/notifications" },
    { icon: HelpCircle, label: "Aide & support", href: "/owner/support" },
  ],
};

const tenantCommands = {
  navigation: [
    { icon: LayoutDashboard, label: "Tableau de bord", href: "/tenant/dashboard", shortcut: "⌘D" },
    { icon: Home, label: "Mon logement", href: "/tenant/lease" },
    { icon: CreditCard, label: "Mes paiements", href: "/tenant/payments", shortcut: "⌘P" },
    { icon: FileText, label: "Mes documents", href: "/tenant/documents" },
    { icon: Wrench, label: "Mes demandes", href: "/tenant/requests" },
    { icon: MessageSquare, label: "Messages", href: "/tenant/messages" },
  ],
  actions: [
    { icon: Plus, label: "Nouvelle demande", href: "/tenant/requests/new", accent: true },
    { icon: CreditCard, label: "Payer mon loyer", href: "/tenant/payments/pay", accent: true },
  ],
  settings: [
    { icon: UserCircle, label: "Mon profil", href: "/tenant/settings/profile" },
    { icon: Bell, label: "Notifications", href: "/tenant/settings/notifications" },
    { icon: HelpCircle, label: "Aide", href: "/tenant/help" },
  ],
};

const adminCommands = {
  navigation: [
    { icon: LayoutDashboard, label: "Dashboard Admin", href: "/admin/dashboard", shortcut: "⌘D" },
    { icon: Users, label: "Annuaire", href: "/admin/people", shortcut: "⌘U" },
    { icon: Building2, label: "Parc immobilier", href: "/admin/properties" },
    { icon: CreditCard, label: "Abonnements", href: "/admin/subscriptions" },
    { icon: Globe, label: "Blog", href: "/admin/blog" },
    { icon: Settings, label: "Configuration", href: "/admin/settings" },
  ],
  actions: [
    { icon: Mail, label: "Envoyer une notification", href: "/admin/notifications/send", accent: true },
    { icon: Plus, label: "Nouvel article blog", href: "/admin/blog/new" },
  ],
  settings: [
    { icon: Settings, label: "Paramètres système", href: "/admin/settings" },
    { icon: Zap, label: "Intégrations", href: "/admin/integrations" },
  ],
};

// Types pour les résultats de recherche
interface SearchResult {
  id: string;
  type: "property" | "tenant" | "lease" | "ticket";
  title: string;
  subtitle?: string;
  href: string;
}

export function CommandPalette({ role = "owner" }: CommandPaletteProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Sélectionner les commandes selon le rôle
  const commands = React.useMemo(() => {
    switch (role) {
      case "tenant":
        return tenantCommands;
      case "admin":
        return adminCommands;
      default:
        return ownerCommands;
    }
  }, [role]);

  // Recherche dynamique
  React.useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const searchData = async () => {
      setIsSearching(true);
      try {
        // Recherche locale dans les données mock pour la démo
        // En production, remplacer par des appels API
        const results: SearchResult[] = [];
        
        // Simuler une recherche (à remplacer par de vrais appels API)
        const query = debouncedQuery.toLowerCase();
        
        // Recherche de propriétés
        if (role === "owner" || role === "admin") {
          const propertyKeywords = ["appartement", "maison", "studio", "parking", "rue", "avenue", "boulevard"];
          if (propertyKeywords.some(k => query.includes(k)) || query.length >= 3) {
            // Fetch réel des propriétés
            try {
              const res = await fetch(`/api/properties?search=${encodeURIComponent(debouncedQuery)}&limit=5`);
              if (res.ok) {
                const data = await res.json();
                if (data.properties) {
                  data.properties.forEach((p: any) => {
                    results.push({
                      id: p.id,
                      type: "property",
                      title: p.adresse_complete || p.nom || "Bien immobilier",
                      subtitle: p.ville ? `${p.type} - ${p.ville}` : p.type,
                      href: `/owner/properties/${p.id}`,
                    });
                  });
                }
              }
            } catch (e) {
              console.error("Erreur recherche propriétés:", e);
            }
          }
        }
        
        // Recherche de locataires
        if (role === "owner" || role === "admin") {
          try {
            const res = await fetch(`/api/tenants?search=${encodeURIComponent(debouncedQuery)}&limit=5`);
            if (res.ok) {
              const data = await res.json();
              if (data.tenants) {
                data.tenants.forEach((t: any) => {
                  results.push({
                    id: t.id,
                    type: "tenant",
                    title: `${t.prenom || ""} ${t.nom || ""}`.trim() || "Locataire",
                    subtitle: t.email,
                    href: `/owner/tenants/${t.id}`,
                  });
                });
              }
            }
          } catch (e) {
            console.error("Erreur recherche locataires:", e);
          }
        }

        setSearchResults(results);
      } catch (error) {
        console.error("Erreur recherche:", error);
      } finally {
        setIsSearching(false);
      }
    };

    searchData();
  }, [debouncedQuery, role]);

  // Raccourci clavier ⌘K / Ctrl+K
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
      // Raccourci ⌘T pour le thème
      if (e.key === "t" && (e.metaKey || e.ctrlKey) && open) {
        e.preventDefault();
        setTheme(theme === "dark" ? "light" : "dark");
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, theme, setTheme]);

  // Reset search quand on ferme
  React.useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [open]);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  // Icône selon le type de résultat
  const getResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "property": return Building2;
      case "tenant": return User;
      case "lease": return FileText;
      case "ticket": return Wrench;
      default: return Search;
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Rechercher pages, biens, locataires..." 
        value={searchQuery}
        onValueChange={setSearchQuery}
      />
      <CommandList>
        <CommandEmpty>
          <div className="py-6 text-center text-sm">
            {isSearching ? (
              <>
                <Loader2 className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3 animate-spin" />
                <p className="text-muted-foreground">Recherche en cours...</p>
              </>
            ) : (
              <>
                <Search className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Aucun résultat trouvé.</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Essayez un autre terme de recherche
                </p>
              </>
            )}
          </div>
        </CommandEmpty>

        {/* Résultats de recherche dynamiques */}
        {searchResults.length > 0 && (
          <>
            <CommandGroup heading="Résultats">
              {searchResults.map((result) => {
                const Icon = getResultIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => runCommand(() => router.push(result.href))}
                    className="flex items-center gap-3 py-3"
                  >
                    <div className="p-1.5 rounded-md bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Navigation */}
        <CommandGroup heading="Navigation">
          {commands.navigation.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => runCommand(() => router.push(item.href))}
              className="flex items-center gap-3 py-3"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
              {item.shortcut && (
                <CommandShortcut>{item.shortcut}</CommandShortcut>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Actions rapides */}
        <CommandGroup heading="Actions rapides">
          {commands.actions.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => runCommand(() => router.push(item.href))}
              className="flex items-center gap-3 py-3"
            >
              <div className={`p-1 rounded ${item.accent ? 'bg-primary/10' : ''}`}>
                <item.icon className={`h-4 w-4 ${item.accent ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <span className={item.accent ? 'font-medium' : ''}>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Paramètres */}
        <CommandGroup heading="Paramètres">
          {commands.settings.map((item) => (
            <CommandItem
              key={item.href}
              onSelect={() => runCommand(() => router.push(item.href))}
              className="flex items-center gap-3 py-3"
            >
              <item.icon className="h-4 w-4 text-muted-foreground" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {/* Thème et actions système */}
        <CommandGroup heading="Système">
          <CommandItem
            onSelect={() => runCommand(() => setTheme(theme === "dark" ? "light" : "dark"))}
            className="flex items-center gap-3 py-3"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Moon className="h-4 w-4 text-muted-foreground" />
            )}
            <span>Changer le thème ({theme === "dark" ? "clair" : "sombre"})</span>
            <CommandShortcut>⌘T</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => router.push("/auth/signout"))}
            className="flex items-center gap-3 py-3 text-red-600"
          >
            <LogOut className="h-4 w-4" />
            <span>Déconnexion</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      {/* Footer avec aide */}
      <div className="border-t px-4 py-3 bg-muted/30">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↓</kbd>
              naviguer
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>
              sélectionner
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">esc</kbd>
              fermer
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-500" />
            <span>Propulsé par IA</span>
          </div>
        </div>
      </div>
    </CommandDialog>
  );
}

// Hook pour ouvrir la command palette de n'importe où
export function useCommandPalette() {
  const [open, setOpen] = React.useState(false);
  
  const toggle = React.useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return { open, setOpen, toggle };
}

