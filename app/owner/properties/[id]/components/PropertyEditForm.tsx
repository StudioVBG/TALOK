"use client";

import { Video } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HABITATION_TYPES,
  PARKING_TYPES,
  PRO_TYPES,
  DPE_OPTIONS,
  TYPES_WITH_FLOOR,
} from "@/lib/constants/property-types";
import type { OwnerProperty } from "@/lib/types/owner-property";

export interface PropertyEditFormProps {
  property: OwnerProperty;
  editedValues: Record<string, unknown>;
  handleFieldChange: (field: string, value: unknown) => void;
  getValue: (field: string) => unknown;
}

/**
 * Formulaire d'édition adapté au type de bien
 * - Parking: type, numéro, niveau, gabarit, sécurité
 * - Local Pro: surface, type, étage, équipements
 * - Habitation: surface, pièces, DPE, chauffage, clim, extérieurs
 */
export function PropertyEditForm({ property, editedValues, handleFieldChange, getValue }: PropertyEditFormProps) {
  const propertyType = property.type || "";
  const isParking = (PARKING_TYPES as readonly string[]).includes(propertyType);
  const isPro = (PRO_TYPES as readonly string[]).includes(propertyType);
  const showEtage = (TYPES_WITH_FLOOR as readonly string[]).includes(propertyType);

  // ========== FORMULAIRE PARKING ==========
  if (isParking) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Type de parking */}
          <div>
            <Label className="text-xs">Type de parking</Label>
            <Select value={String(getValue("parking_type") || "")} onValueChange={(v) => handleFieldChange("parking_type", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="place_exterieure">Place extérieure</SelectItem>
                <SelectItem value="place_couverte">Place couverte</SelectItem>
                <SelectItem value="box">Box fermé</SelectItem>
                <SelectItem value="souterrain">Souterrain</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Numéro de place */}
          <div>
            <Label className="text-xs">N° de place</Label>
            <Input
              value={String(getValue("parking_numero") || "")}
              onChange={(e) => handleFieldChange("parking_numero", e.target.value)}
              placeholder="Ex: A42"
              className="mt-1 h-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Niveau */}
          <div>
            <Label className="text-xs">Niveau</Label>
            <Input
              value={String(getValue("parking_niveau") || "")}
              onChange={(e) => handleFieldChange("parking_niveau", e.target.value)}
              placeholder="Ex: -1, RDC"
              className="mt-1 h-9"
            />
          </div>
          {/* Gabarit */}
          <div>
            <Label className="text-xs">Gabarit max</Label>
            <Select value={String(getValue("parking_gabarit") || "")} onValueChange={(v) => handleFieldChange("parking_gabarit", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="2_roues">2 roues</SelectItem>
                <SelectItem value="citadine">Citadine</SelectItem>
                <SelectItem value="berline">Berline</SelectItem>
                <SelectItem value="suv">SUV</SelectItem>
                <SelectItem value="utilitaire">Utilitaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Surface (pour box) */}
        {property.type === "box" && (
          <div className="w-1/2">
            <Label className="text-xs">Surface (m²)</Label>
            <Input
              type="number"
              value={String(getValue("surface") || "")}
              onChange={(e) => handleFieldChange("surface", e.target.value)}
              className="mt-1 h-9"
            />
          </div>
        )}

        {/* Sécurité */}
        <div className="p-3 bg-slate-50 rounded-lg">
          <Label className="text-xs font-medium mb-3 block">Sécurité</Label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(getValue("parking_portail_securise"))}
                onCheckedChange={(c) => handleFieldChange("parking_portail_securise", c)}
              />
              <span className="text-sm">Portail sécurisé</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(getValue("parking_video_surveillance"))}
                onCheckedChange={(c) => handleFieldChange("parking_video_surveillance", c)}
              />
              <span className="text-sm">Vidéosurveillance</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={Boolean(getValue("parking_gardien"))}
                onCheckedChange={(c) => handleFieldChange("parking_gardien", c)}
              />
              <span className="text-sm">Gardien</span>
            </div>
          </div>
        </div>

        {/* Visite virtuelle */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Label className="text-xs font-medium mb-2 flex items-center gap-2">
            <Video className="h-4 w-4 text-blue-600" />
            Visite virtuelle (optionnel)
          </Label>
          <Input
            value={String(getValue("visite_virtuelle_url") || "")}
            onChange={(e) => handleFieldChange("visite_virtuelle_url", e.target.value)}
            placeholder="https://my.matterport.com/show/?m=..."
            className="mt-1 h-9"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Lien Matterport, Nodalview, ou autre service de visite 360°
          </p>
        </div>
      </div>
    );
  }

  // ========== FORMULAIRE LOCAL PRO ==========
  if (isPro) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Surface */}
          <div>
            <Label className="text-xs">Surface totale (m²)</Label>
            <Input
              type="number"
              value={String(getValue("local_surface_totale") || getValue("surface") || "")}
              onChange={(e) => {
                handleFieldChange("local_surface_totale", e.target.value);
                handleFieldChange("surface", e.target.value);
              }}
              className="mt-1 h-9"
            />
          </div>
          {/* Type de local */}
          <div>
            <Label className="text-xs">Type de local</Label>
            <Select value={String(getValue("local_type") || "")} onValueChange={(v) => handleFieldChange("local_type", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="boutique">Boutique</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="bureaux">Bureaux</SelectItem>
                <SelectItem value="atelier">Atelier</SelectItem>
                <SelectItem value="stockage">Stockage</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Étage */}
        {showEtage && (
          <div className="w-1/2">
            <Label className="text-xs">Étage / Niveau</Label>
            <Input
              type="number"
              value={getValue("etage") != null ? String(getValue("etage")) : ""}
              onChange={(e) => handleFieldChange("etage", e.target.value)}
              placeholder="0 = RDC"
              className="mt-1 h-9"
            />
          </div>
        )}

        {/* Équipements */}
        <div className="p-3 bg-slate-50 rounded-lg">
          <Label className="text-xs font-medium mb-3 block">Équipements</Label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_has_vitrine"))} onCheckedChange={(c) => handleFieldChange("local_has_vitrine", c)} />
              <span className="text-sm">Vitrine</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_access_pmr"))} onCheckedChange={(c) => handleFieldChange("local_access_pmr", c)} />
              <span className="text-sm">Accès PMR</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_clim"))} onCheckedChange={(c) => handleFieldChange("local_clim", c)} />
              <span className="text-sm">Climatisation</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_fibre"))} onCheckedChange={(c) => handleFieldChange("local_fibre", c)} />
              <span className="text-sm">Fibre optique</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_alarme"))} onCheckedChange={(c) => handleFieldChange("local_alarme", c)} />
              <span className="text-sm">Alarme</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_rideau_metal"))} onCheckedChange={(c) => handleFieldChange("local_rideau_metal", c)} />
              <span className="text-sm">Rideau métallique</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_acces_camion"))} onCheckedChange={(c) => handleFieldChange("local_acces_camion", c)} />
              <span className="text-sm">Accès camion</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={Boolean(getValue("local_parking_clients"))} onCheckedChange={(c) => handleFieldChange("local_parking_clients", c)} />
              <span className="text-sm">Parking clients</span>
            </div>
          </div>
        </div>

        {/* Visite virtuelle */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <Label className="text-xs font-medium mb-2 flex items-center gap-2">
            <Video className="h-4 w-4 text-blue-600" />
            Visite virtuelle (optionnel)
          </Label>
          <Input
            value={String(getValue("visite_virtuelle_url") || "")}
            onChange={(e) => handleFieldChange("visite_virtuelle_url", e.target.value)}
            placeholder="https://my.matterport.com/show/?m=..."
            className="mt-1 h-9"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Lien Matterport, Nodalview, ou autre service de visite 360°
          </p>
        </div>
      </div>
    );
  }

  // ========== FORMULAIRE HABITATION (par défaut) ==========
  return (
    <div className="space-y-4">
      {/* Surface & Pièces */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <Label className="text-xs">Surface (m²)</Label>
          <Input
            type="number"
            value={String(getValue("surface") || "")}
            onChange={(e) => handleFieldChange("surface", e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Pièces</Label>
          <Input
            type="number"
            value={String(getValue("nb_pieces") || "")}
            onChange={(e) => handleFieldChange("nb_pieces", e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        <div>
          <Label className="text-xs">Chambres</Label>
          <Input
            type="number"
            value={String(getValue("nb_chambres") || "")}
            onChange={(e) => handleFieldChange("nb_chambres", e.target.value)}
            className="mt-1 h-9"
          />
        </div>
        {showEtage && (
          <div>
            <Label className="text-xs">Étage</Label>
            <Input
              type="number"
              value={getValue("etage") != null ? String(getValue("etage")) : ""}
              onChange={(e) => handleFieldChange("etage", e.target.value)}
              placeholder="0 = RDC"
              className="mt-1 h-9"
            />
          </div>
        )}
      </div>

      {/* Switches */}
      <div className="flex flex-wrap gap-6">
        {showEtage && (
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(getValue("ascenseur"))} onCheckedChange={(c) => handleFieldChange("ascenseur", c)} />
            <span className="text-sm">Ascenseur</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Switch checked={Boolean(getValue("meuble"))} onCheckedChange={(c) => handleFieldChange("meuble", c)} />
          <span className="text-sm">Meublé</span>
        </div>
      </div>

      {/* DPE */}
      <div className="p-3 bg-green-50 rounded-lg">
        <Label className="text-xs font-medium mb-3 block">DPE - Diagnostic de Performance Énergétique</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Classe énergie</Label>
            <div className="flex gap-1 mt-1">
              {DPE_OPTIONS.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => handleFieldChange("dpe_classe_energie", cls)}
                  className={`flex-1 h-8 rounded text-sm font-bold text-white transition-all ${
                    cls === "A" ? "bg-green-600" :
                    cls === "B" ? "bg-lime-500" :
                    cls === "C" ? "bg-yellow-400 text-black" :
                    cls === "D" ? "bg-amber-400 text-black" :
                    cls === "E" ? "bg-orange-500" :
                    cls === "F" ? "bg-red-500" : "bg-red-700"
                  } ${getValue("dpe_classe_energie") === cls ? "ring-2 ring-offset-1 ring-primary scale-105" : "opacity-60 hover:opacity-100"}`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Émissions GES</Label>
            <div className="flex gap-1 mt-1">
              {DPE_OPTIONS.map((cls) => (
                <button
                  key={cls}
                  type="button"
                  onClick={() => handleFieldChange("dpe_classe_climat", cls)}
                  className={`flex-1 h-8 rounded text-sm font-bold text-white transition-all ${
                    cls === "A" ? "bg-violet-200 text-violet-900" :
                    cls === "B" ? "bg-violet-300 text-violet-900" :
                    cls === "C" ? "bg-violet-400" :
                    cls === "D" ? "bg-violet-500" :
                    cls === "E" ? "bg-violet-600" :
                    cls === "F" ? "bg-violet-700" : "bg-violet-800"
                  } ${getValue("dpe_classe_climat") === cls ? "ring-2 ring-offset-1 ring-primary scale-105" : "opacity-60 hover:opacity-100"}`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chauffage & Eau chaude */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-3 bg-orange-50 rounded-lg">
          <Label className="text-xs font-medium mb-2 block">Chauffage</Label>
          <Select value={String(getValue("chauffage_type") || "")} onValueChange={(v) => handleFieldChange("chauffage_type", v)}>
            <SelectTrigger className="h-9 mb-2"><SelectValue placeholder="Type..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individuel">Individuel</SelectItem>
              <SelectItem value="collectif">Collectif</SelectItem>
              <SelectItem value="aucun">Aucun</SelectItem>
            </SelectContent>
          </Select>
          {Boolean(getValue("chauffage_type")) && getValue("chauffage_type") !== "aucun" && (
            <Select value={String(getValue("chauffage_energie") || "")} onValueChange={(v) => handleFieldChange("chauffage_energie", v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Énergie..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="electricite">Électricité</SelectItem>
                <SelectItem value="gaz">Gaz</SelectItem>
                <SelectItem value="fioul">Fioul</SelectItem>
                <SelectItem value="bois">Bois</SelectItem>
                <SelectItem value="reseau_urbain">Réseau urbain</SelectItem>
                <SelectItem value="autre">Autre</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="p-3 bg-blue-50 rounded-lg">
          <Label className="text-xs font-medium mb-2 block">Eau chaude</Label>
          <Select value={String(getValue("eau_chaude_type") || "")} onValueChange={(v) => handleFieldChange("eau_chaude_type", v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Type..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="electrique_indiv">Électrique individuel</SelectItem>
              <SelectItem value="gaz_indiv">Gaz individuel</SelectItem>
              <SelectItem value="collectif">Collectif</SelectItem>
              <SelectItem value="solaire">Solaire</SelectItem>
              <SelectItem value="autre">Autre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Climatisation */}
      <div className="p-3 bg-cyan-50 rounded-lg">
        <Label className="text-xs font-medium mb-2 block">Climatisation</Label>
        <div className="flex items-center gap-4">
          <Select value={String(getValue("clim_presence") || "aucune")} onValueChange={(v) => handleFieldChange("clim_presence", v)}>
            <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="aucune">Aucune</SelectItem>
              <SelectItem value="fixe">Fixe</SelectItem>
              <SelectItem value="mobile">Mobile</SelectItem>
            </SelectContent>
          </Select>
          {getValue("clim_presence") === "fixe" && (
            <Select value={String(getValue("clim_type") || "")} onValueChange={(v) => handleFieldChange("clim_type", v)}>
              <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="split">Split</SelectItem>
                <SelectItem value="gainable">Gainable</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Extérieurs */}
      <div className="p-3 bg-slate-50 rounded-lg">
        <Label className="text-xs font-medium mb-3 block">Extérieurs & Annexes</Label>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(getValue("has_balcon"))} onCheckedChange={(c) => handleFieldChange("has_balcon", c)} />
            <span className="text-sm">Balcon</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(getValue("has_terrasse"))} onCheckedChange={(c) => handleFieldChange("has_terrasse", c)} />
            <span className="text-sm">Terrasse</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(getValue("has_jardin"))} onCheckedChange={(c) => handleFieldChange("has_jardin", c)} />
            <span className="text-sm">Jardin</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={Boolean(getValue("has_cave"))} onCheckedChange={(c) => handleFieldChange("has_cave", c)} />
            <span className="text-sm">Cave</span>
          </div>
        </div>
      </div>

      {/* Visite virtuelle */}
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
        <Label className="text-xs font-medium mb-2 flex items-center gap-2">
          <Video className="h-4 w-4 text-blue-600" />
          Visite virtuelle (optionnel)
        </Label>
        <Input
          value={String(getValue("visite_virtuelle_url") || "")}
          onChange={(e) => handleFieldChange("visite_virtuelle_url", e.target.value)}
          placeholder="https://my.matterport.com/show/?m=..."
          className="mt-1 h-9"
        />
        <p className="text-[10px] text-muted-foreground mt-1">
          Lien Matterport, Nodalview, ou autre service de visite 360°
        </p>
      </div>
    </div>
  );
}
