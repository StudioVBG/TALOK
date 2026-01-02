"use client";

import * as React from "react";
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  User,
  Search,
  Building2,
  FileText,
  MessageSquare,
  Plus,
  Wrench,
  BarChart3,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { OWNER_ROUTES } from "@/lib/config/owner-routes";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors w-full max-w-[200px] border border-slate-200"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Recherche...</span>
        <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Rechercher un bien, un locataire, un bail..." />
        <CommandList>
          <CommandEmpty>Aucun résultat trouvé.</CommandEmpty>
          <CommandGroup heading="Modules">
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.dashboard.path))}>
              <BarChart3 className="mr-2 h-4 w-4" />
              <span>Tableau de bord</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.properties.path))}>
              <Building2 className="mr-2 h-4 w-4" />
              <span>Mes Biens</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.contracts.path))}>
              <FileText className="mr-2 h-4 w-4" />
              <span>Mes Baux</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.tenants.path))}>
              <Users className="mr-2 h-4 w-4" />
              <span>Mes Locataires</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.money.path))}>
              <CreditCard className="mr-2 h-4 w-4" />
              <span>Finances & Loyers</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.tickets.path))}>
              <Wrench className="mr-2 h-4 w-4" />
              <span>Tickets de maintenance</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions rapides">
            <CommandItem onSelect={() => runCommand(() => router.push(`${OWNER_ROUTES.properties.path}/new`))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Ajouter un bien</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(`${OWNER_ROUTES.contracts.path}/new`))}>
              <Plus className="mr-2 h-4 w-4" />
              <span>Créer un bail</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.taxes.path))}>
              <Calculator className="mr-2 h-4 w-4" />
              <span>Simulateur fiscal</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Paramètres">
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.profile.path))}>
              <User className="mr-2 h-4 w-4" />
              <span>Mon Profil</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push(OWNER_ROUTES.settings.path))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Paramètres du compte</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

