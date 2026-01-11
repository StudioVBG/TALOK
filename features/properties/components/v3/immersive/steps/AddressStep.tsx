"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { usePropertyWizardStore } from "@/features/properties/stores/wizard-store";
import { MapPin, Check, Building2, HelpCircle, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getDepartementCodeFromCP, getDepartementNameFromCP, DEPARTEMENT_NAMES } from "@/lib/helpers/address-utils";

// Mapping QUARTIERS/LIEUX-DITS -> CODE POSTAL (Martinique principalement)
// Permet de détecter le code postal depuis un nom de quartier
const QUARTIER_TO_POSTAL_CODE: Record<string, string> = {
  // Le Lamentin (97232)
  "acajou": "97232",
  "la lézarde": "97232",
  "bois rouge": "97232",
  "petit manoir": "97232",
  "long pré": "97232",
  "californie": "97232",
  "pelletier": "97232",
  "roches carrées": "97232",
  "mangot vulcin": "97232",
  // Fort-de-France (97200)
  "didier": "97200",
  "cluny": "97200",
  "terres sainville": "97200",
  "redoute": "97200",
  "bellevue": "97200",
  "saint-thérèse": "97200",
  "dillon": "97200",
  "floréal": "97200",
  // Le Robert (97231)
  "pointe lynch": "97231",
  "mansarde": "97231",
  "vert pré": "97231",
  "fond d'or": "97231",
  // Schoelcher (97233)
  "case navire": "97233",
  "fond lahaye": "97233",
  "terreville": "97233",
  // Ducos (97224)
  "génipa": "97224",
  "petit bourg": "97224",
  // Autres communes
  "basse-pointe": "97218",
  "grand'rivière": "97218",
  "macouba": "97218",
  "ajoupa-bouillon": "97216",
  "bellefontaine": "97222",
  "fonds saint-denis": "97250",
  "gros-morne": "97213",
  "lorrain": "97214",
  "marigot": "97225",
  "morne-vert": "97226",
  "prêcheur": "97250",
  "rivière-pilote": "97211",
  "rivière-salée": "97215",
  "saint-joseph": "97212",
  "sainte-luce": "97228",
  "schœlcher": "97233",
};

// Mapping CORRECT code postal -> ville (1 code = 1 ville principale)
// Sources: La Poste, INSEE - Mis à jour pour la France + DROM
const POSTAL_CODE_TO_CITY: Record<string, string> = {
  // === MARTINIQUE (972) ===
  "97200": "Fort-de-France",
  "97201": "Fort-de-France",
  "97209": "Fort-de-France",
  "97220": "La Trinité",        // ⚠️ CORRIGÉ: 97220 = La Trinité (pas Le Robert!)
  "97221": "Le Carbet",
  "97222": "Case-Pilote",
  "97223": "Le Diamant",
  "97224": "Ducos",
  "97225": "Le Marigot",
  "97226": "Le Morne-Rouge",
  "97227": "Sainte-Anne",
  "97228": "Sainte-Luce",
  "97229": "Les Trois-Îlets",
  "97230": "Sainte-Marie",
  "97231": "Le Robert",         // Le Robert = 97231
  "97232": "Le Lamentin",
  "97233": "Schoelcher",
  "97234": "Fort-de-France",    // Secteur Didier
  "97240": "Le François",       // Le François = 97240
  "97250": "Fonds-Saint-Denis",
  "97260": "Le Morne-Rouge",
  "97270": "Saint-Esprit",
  "97280": "Le Vauclin",
  "97290": "Le Marin",
  // === GUADELOUPE (971) ===
  "97100": "Basse-Terre",
  "97110": "Pointe-à-Pitre",
  "97111": "Morne-à-l'Eau",
  "97112": "Grand-Bourg",
  "97113": "Gourbeyre",
  "97114": "Trois-Rivières",
  "97115": "Sainte-Rose",
  "97116": "Pointe-Noire",
  "97117": "Port-Louis",
  "97118": "Saint-François",
  "97119": "Vieux-Habitants",
  "97120": "Saint-Claude",
  "97121": "Anse-Bertrand",
  "97122": "Baie-Mahault",
  "97123": "Baillif",
  "97125": "Bouillante",
  "97126": "Deshaies",
  "97128": "Goyave",
  "97129": "Lamentin",
  "97130": "Capesterre-Belle-Eau",
  "97131": "Petit-Canal",
  "97134": "Saint-Louis",
  "97139": "Les Abymes",
  "97140": "Capesterre-de-Marie-Galante",
  "97150": "Saint-Martin",
  "97160": "Le Moule",
  "97170": "Petit-Bourg",
  "97180": "Sainte-Anne",
  "97190": "Le Gosier",
  // === LA RÉUNION (974) ===
  "97400": "Saint-Denis",
  "97410": "Saint-Pierre",
  "97411": "Bois-de-Nèfles",
  "97412": "Bras-Panon",
  "97413": "Cilaos",
  "97414": "Entre-Deux",
  "97417": "La Montagne",
  "97418": "La Plaine-des-Cafres",
  "97419": "La Possession",
  "97420": "Le Port",
  "97421": "La Rivière",
  "97422": "La Saline",
  "97423": "Le Guillaume",
  "97424": "Piton Saint-Leu",
  "97425": "Les Avirons",
  "97426": "Les Trois-Bassins",
  "97427": "L'Étang-Salé",
  "97429": "Petite-Île",
  "97430": "Le Tampon",
  "97431": "La Plaine-des-Palmistes",
  "97432": "Ravine-des-Cabris",
  "97433": "Salazie",
  "97434": "Saint-Gilles-les-Bains",
  "97435": "Saint-Gilles-les-Hauts",
  "97436": "Saint-Leu",
  "97438": "Sainte-Marie",
  "97439": "Sainte-Rose",
  "97440": "Saint-André",
  "97441": "Sainte-Suzanne",
  "97450": "Saint-Louis",
  "97460": "Saint-Paul",
  "97470": "Saint-Benoît",
  "97480": "Saint-Joseph",
  "97490": "Sainte-Clotilde",
  // === GUYANE (973) ===
  "97300": "Cayenne",
  "97310": "Kourou",
  "97320": "Saint-Laurent-du-Maroni",
  "97351": "Matoury",
  "97354": "Rémire-Montjoly",
  "97355": "Macouria",
  // === MAYOTTE (976) ===
  "97600": "Mamoudzou",
  "97605": "Pamandzi",
  "97610": "Dzaoudzi",
  "97620": "Chirongui",
  "97630": "Dembeni",
  "97640": "Sada",
  "97650": "Bandraboua",
  "97660": "Dembeni",
  "97670": "Ouangani",
  "97680": "Tsingoni",
  // === PARIS & IDF ===
  "75001": "Paris 1er",
  "75002": "Paris 2e",
  "75003": "Paris 3e",
  "75004": "Paris 4e",
  "75005": "Paris 5e",
  "75006": "Paris 6e",
  "75007": "Paris 7e",
  "75008": "Paris 8e",
  "75009": "Paris 9e",
  "75010": "Paris 10e",
  "75011": "Paris 11e",
  "75012": "Paris 12e",
  "75013": "Paris 13e",
  "75014": "Paris 14e",
  "75015": "Paris 15e",
  "75016": "Paris 16e",
  "75017": "Paris 17e",
  "75018": "Paris 18e",
  "75019": "Paris 19e",
  "75020": "Paris 20e",
};

export function AddressStep() {
  const { formData, updateFormData } = usePropertyWizardStore();
  const [autoFilledDept, setAutoFilledDept] = useState<string | null>(null);

  // SOTA 2026: Ref pour stocker les timers et éviter les memory leaks
  const autoFillTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup des timers au démontage du composant
  useEffect(() => {
    return () => {
      if (autoFillTimerRef.current) {
        clearTimeout(autoFillTimerRef.current);
      }
    };
  }, []);

  // Fonction helper pour auto-effacer le message de département
  const showAutoFilledDept = (deptName: string) => {
    // Clear timer précédent
    if (autoFillTimerRef.current) {
      clearTimeout(autoFillTimerRef.current);
    }
    setAutoFilledDept(deptName);
    autoFillTimerRef.current = setTimeout(() => {
      setAutoFilledDept(null);
      autoFillTimerRef.current = null;
    }, 3000);
  };
  
  // Extraire le code postal d'une chaîne d'adresse
  const extractPostalCode = (address: string): string | null => {
    // 1. D'abord chercher un code postal explicite (5 chiffres)
    const matches = address.match(/\b(97\d{3}|98\d{3}|\d{5})\b/g);
    if (matches && matches.length > 0) {
      // Préférer les codes DOM s'il y en a plusieurs
      const domCode = matches.find(m => m.startsWith('97') || m.startsWith('98'));
      return domCode || matches[matches.length - 1];
    }
    
    // 2. Si pas de code postal, chercher un nom de quartier connu (Martinique)
    const normalizedAddress = address.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Enlever accents
    
    for (const [quartier, cp] of Object.entries(QUARTIER_TO_POSTAL_CODE)) {
      const normalizedQuartier = quartier.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedAddress.includes(normalizedQuartier)) {
        return cp;
      }
    }
    
    // 3. Chercher les noms de villes directement
    const villeToCP: Record<string, string> = {
      "lamentin": "97232",
      "le lamentin": "97232",
      "fort-de-france": "97200",
      "fort de france": "97200",
      "schoelcher": "97233",
      "schœlcher": "97233",
      "robert": "97231",
      "le robert": "97231",
      "francois": "97240",
      "le françois": "97240",
      "trinite": "97220",
      "la trinité": "97220",
      "ducos": "97224",
      "marin": "97290",
      "le marin": "97290",
      "vauclin": "97280",
      "le vauclin": "97280",
      "sainte-anne": "97227",
      "sainte-luce": "97228",
      "trois-ilets": "97229",
      "les trois-îlets": "97229",
      "diamant": "97223",
      "le diamant": "97223",
      "carbet": "97221",
      "le carbet": "97221",
      "sainte-marie": "97230",
      "saint-esprit": "97270",
    };
    
    for (const [ville, cp] of Object.entries(villeToCP)) {
      const normalizedVille = ville.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (normalizedAddress.includes(normalizedVille)) {
        return cp;
      }
    }
    
    return null;
  };

  const handleChange = (field: string, value: string) => {
    updateFormData({ [field]: value });
    
    // Si on modifie l'adresse complète, essayer d'extraire le code postal
    if (field === "adresse_complete" && value.length > 10) {
      const extractedCP = extractPostalCode(value);
      if (extractedCP && extractedCP !== formData.code_postal) {
        // Mettre à jour le code postal extrait
        updateFormData({ code_postal: extractedCP });
        
        // Auto-remplir la ville correspondante
        const city = POSTAL_CODE_TO_CITY[extractedCP];
        if (city) {
          updateFormData({ ville: city });
        }
        
        // Stocker le département
        const deptCode = getDepartementCodeFromCP(extractedCP);
        if (deptCode) {
          updateFormData({ departement: deptCode });
          const deptName = DEPARTEMENT_NAMES[deptCode];
          if (deptName) {
            showAutoFilledDept(deptName);
          }
        }
      }
    }
    
    if (field === "code_postal" && value.length === 5) {
      // Auto-remplir la ville si le code postal est connu
      const city = POSTAL_CODE_TO_CITY[value];
      if (city) {
        updateFormData({ ville: city });
      }
      // Stocker le CODE département (ex: "972") pas le nom
      const deptCode = getDepartementCodeFromCP(value);
      if (deptCode) {
        updateFormData({ departement: deptCode });
        const deptName = DEPARTEMENT_NAMES[deptCode];
        if (deptName) {
          showAutoFilledDept(deptName);
        }
      }
    }

    // ✅ NOUVEAU: Si on modifie la ville, essayer de déduire le code postal
    if (field === "ville" && value.length >= 3) {
      const normalizedVille = value.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/-/g, " ")
        .trim();
      
      // Mapping ville → code postal
      const VILLE_TO_CP: Record<string, string> = {
        // Martinique
        "le lamentin": "97232", "lamentin": "97232",
        "fort de france": "97200", "fort-de-france": "97200",
        "schoelcher": "97233", "schœlcher": "97233",
        "le robert": "97231", "robert": "97231",
        "le francois": "97240", "francois": "97240", "le françois": "97240",
        "la trinite": "97220", "trinite": "97220", "la trinité": "97220",
        "ducos": "97224",
        "le marin": "97290", "marin": "97290",
        "le vauclin": "97280", "vauclin": "97280",
        "sainte anne": "97227", "sainte-anne": "97227",
        "sainte luce": "97228", "sainte-luce": "97228",
        "les trois ilets": "97229", "trois ilets": "97229",
        "le diamant": "97223", "diamant": "97223",
        "le carbet": "97221", "carbet": "97221",
        "sainte marie": "97230", "sainte-marie": "97230",
        "saint esprit": "97270", "saint-esprit": "97270",
        "riviere salee": "97215", "riviere-salee": "97215",
        "saint joseph": "97212", "saint-joseph": "97212",
        "gros morne": "97213", "gros-morne": "97213",
        // Guadeloupe
        "pointe a pitre": "97110", "pointe-a-pitre": "97110",
        "les abymes": "97139", "abymes": "97139",
        "baie mahault": "97122", "baie-mahault": "97122",
        "le gosier": "97190", "gosier": "97190",
        "basse terre": "97100", "basse-terre": "97100",
        // Réunion
        "saint denis": "97400", "saint-denis": "97400",
        "saint pierre": "97410", "saint-pierre": "97410",
        "le port": "97420",
        "le tampon": "97430", "tampon": "97430",
        "saint paul": "97460", "saint-paul": "97460",
        // Guyane
        "cayenne": "97300",
        "kourou": "97310",
      };
      
      // Chercher correspondance
      const cpFromVille = VILLE_TO_CP[normalizedVille];
      if (cpFromVille && (!formData.code_postal || formData.code_postal === "")) {
        updateFormData({ code_postal: cpFromVille });
        
        // Stocker le département automatiquement
        const deptCode = getDepartementCodeFromCP(cpFromVille);
        if (deptCode) {
          updateFormData({ departement: deptCode });
          const deptName = DEPARTEMENT_NAMES[deptCode];
          if (deptName) {
            showAutoFilledDept(deptName);
          }
        }
      }
    }
  };

  const detectedDept = useMemo(() => {
    if (!formData.code_postal || (formData.code_postal as string).length < 2) return null;
    const code = getDepartementCodeFromCP(formData.code_postal as string);
    return code ? DEPARTEMENT_NAMES[code] : null;
  }, [formData.code_postal]);

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col justify-center max-w-xl mx-auto">
        <div className="space-y-4">
          {/* Adresse Complète avec Auto-complétion */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label htmlFor="adresse" className="text-sm font-medium">Adresse complète</Label>
              <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded-full">
                <Sparkles className="h-2.5 w-2.5" />
                Auto-complétion
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent><p>Tapez 3 caractères pour voir les suggestions</p></TooltipContent>
              </Tooltip>
            </div>
            <AddressAutocomplete
              value={formData.adresse_complete as string || ""}
              onChange={(value) => handleChange("adresse_complete", value)}
              onSelect={({ adresse_complete, ville, code_postal, departement, latitude, longitude }) => {
                updateFormData({
                  adresse_complete,
                  ville,
                  code_postal,
                  departement,
                  latitude,
                  longitude,
                });
                if (departement) {
                  const deptName = DEPARTEMENT_NAMES[departement];
                  if (deptName) {
                    showAutoFilledDept(deptName);
                  }
                }
              }}
              placeholder="Tapez une adresse..."
            />
          </div>

          {/* Complément */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Complément (Optionnel)</Label>
            <Input
              placeholder="Bâtiment, étage, porte..."
              className="h-11"
              value={formData.complement_adresse || ""}
              onChange={(e) => handleChange("complement_adresse", e.target.value)}
            />
          </div>

          {/* CP / Ville */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Code Postal *</Label>
              <Input
                placeholder="97200"
                maxLength={5}
                className={cn("h-11", !formData.code_postal && "border-red-300 bg-red-50/50")}
                value={formData.code_postal === "00000" ? "" : formData.code_postal || ""}
                onChange={(e) => handleChange("code_postal", e.target.value.replace(/\D/g, '').slice(0, 5))}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-sm font-medium">Ville *</Label>
              <Input
                placeholder="Fort-de-France"
                className={cn("h-11", !formData.ville && "border-red-300 bg-red-50/50")}
                value={formData.ville === "Ville à définir" ? "" : formData.ville || ""}
                onChange={(e) => handleChange("ville", e.target.value)}
              />
            </div>
          </div>

          {/* Département */}
          <AnimatePresence>
            {detectedDept && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20"
              >
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Département détecté</p>
                  <p className="text-sm font-semibold">{detectedDept}</p>
                </div>
                {autoFilledDept && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}
