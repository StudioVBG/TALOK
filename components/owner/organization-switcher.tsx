"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Building2, User, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Organization, OrganizationType } from "@/lib/types/multi-company";
import { ORGANIZATION_TYPE_LABELS } from "@/lib/types/multi-company";

// Icons par type d'organisation
const ORGANIZATION_ICONS: Record<OrganizationType, React.ElementType> = {
  particulier: User,
  sci_ir: Building2,
  sci_is: Building2,
  sarl_famille: Briefcase,
  sas: Briefcase,
  indivision: User,
  usufruit: User,
  nue_propriete: User,
  lmnp: Building2,
  lmp: Building2,
};

// Couleurs par type
const ORGANIZATION_COLORS: Record<OrganizationType, string> = {
  particulier: "bg-slate-100 text-slate-800",
  sci_ir: "bg-blue-100 text-blue-800",
  sci_is: "bg-indigo-100 text-indigo-800",
  sarl_famille: "bg-purple-100 text-purple-800",
  sas: "bg-violet-100 text-violet-800",
  indivision: "bg-amber-100 text-amber-800",
  usufruit: "bg-orange-100 text-orange-800",
  nue_propriete: "bg-rose-100 text-rose-800",
  lmnp: "bg-emerald-100 text-emerald-800",
  lmp: "bg-teal-100 text-teal-800",
};

interface OrganizationSwitcherProps {
  organizations: Organization[];
  currentOrganizationId?: string | null;
  onSelect: (organizationId: string) => void;
  onCreateNew?: () => void;
  className?: string;
  showPropertyCount?: boolean;
  propertyCountByOrg?: Record<string, number>;
}

export function OrganizationSwitcher({
  organizations,
  currentOrganizationId,
  onSelect,
  onCreateNew,
  className,
  showPropertyCount = true,
  propertyCountByOrg = {},
}: OrganizationSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const currentOrg = organizations.find((org) => org.id === currentOrganizationId);

  // Grouper les organisations par type
  const groupedOrgs = React.useMemo(() => {
    const groups: Record<string, Organization[]> = {
      personnel: [],
      societes: [],
      autres: [],
    };

    organizations.forEach((org) => {
      if (org.type === "particulier") {
        groups.personnel.push(org);
      } else if (["sci_ir", "sci_is", "sarl_famille", "sas"].includes(org.type)) {
        groups.societes.push(org);
      } else {
        groups.autres.push(org);
      }
    });

    return groups;
  }, [organizations]);

  // Filtrer par recherche
  const filteredOrgs = React.useMemo(() => {
    if (!search) return organizations;
    const searchLower = search.toLowerCase();
    return organizations.filter(
      (org) =>
        org.nom_entite.toLowerCase().includes(searchLower) ||
        org.siret?.includes(search) ||
        ORGANIZATION_TYPE_LABELS[org.type].toLowerCase().includes(searchLower)
    );
  }, [organizations, search]);

  const renderOrganizationItem = (org: Organization) => {
    const Icon = ORGANIZATION_ICONS[org.type];
    const propertyCount = propertyCountByOrg[org.id] || 0;

    return (
      <CommandItem
        key={org.id}
        value={org.id}
        onSelect={() => {
          onSelect(org.id);
          setOpen(false);
        }}
        className="flex items-center gap-3 py-3"
      >
        <div className={cn("p-2 rounded-lg", ORGANIZATION_COLORS[org.type])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{org.nom_entite}</span>
            {org.is_default && (
              <Badge variant="secondary" className="text-xs">
                Par défaut
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{ORGANIZATION_TYPE_LABELS[org.type]}</span>
            {org.siret && (
              <>
                <span className="text-slate-300">|</span>
                <span className="font-mono">{org.siret}</span>
              </>
            )}
            {showPropertyCount && (
              <>
                <span className="text-slate-300">|</span>
                <span>{propertyCount} bien{propertyCount !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>
        <Check
          className={cn(
            "h-4 w-4",
            currentOrganizationId === org.id ? "opacity-100" : "opacity-0"
          )}
        />
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Sélectionner une organisation"
          className={cn("justify-between", className)}
        >
          {currentOrg ? (
            <div className="flex items-center gap-2 truncate">
              <div className={cn("p-1.5 rounded", ORGANIZATION_COLORS[currentOrg.type])}>
                {React.createElement(ORGANIZATION_ICONS[currentOrg.type], {
                  className: "h-3.5 w-3.5",
                })}
              </div>
              <span className="truncate">{currentOrg.nom_entite}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">Sélectionner une organisation</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Rechercher une organisation..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Aucune organisation trouvée.</CommandEmpty>

            {/* Groupe Personnel */}
            {groupedOrgs.personnel.length > 0 && (
              <CommandGroup heading="Personnel">
                {groupedOrgs.personnel
                  .filter((org) => filteredOrgs.includes(org))
                  .map(renderOrganizationItem)}
              </CommandGroup>
            )}

            {/* Groupe Sociétés */}
            {groupedOrgs.societes.length > 0 && (
              <CommandGroup heading="Sociétés">
                {groupedOrgs.societes
                  .filter((org) => filteredOrgs.includes(org))
                  .map(renderOrganizationItem)}
              </CommandGroup>
            )}

            {/* Groupe Autres */}
            {groupedOrgs.autres.length > 0 && (
              <CommandGroup heading="Autres structures">
                {groupedOrgs.autres
                  .filter((org) => filteredOrgs.includes(org))
                  .map(renderOrganizationItem)}
              </CommandGroup>
            )}

            {/* Action: Nouvelle organisation */}
            {onCreateNew && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      setOpen(false);
                      onCreateNew();
                    }}
                    className="cursor-pointer"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    <span>Ajouter une organisation</span>
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// Composant compact pour l'en-tête
export function OrganizationSwitcherCompact({
  organizations,
  currentOrganizationId,
  onSelect,
  onCreateNew,
}: Omit<OrganizationSwitcherProps, "className" | "showPropertyCount" | "propertyCountByOrg">) {
  return (
    <OrganizationSwitcher
      organizations={organizations}
      currentOrganizationId={currentOrganizationId}
      onSelect={onSelect}
      onCreateNew={onCreateNew}
      className="w-[200px]"
      showPropertyCount={false}
    />
  );
}
