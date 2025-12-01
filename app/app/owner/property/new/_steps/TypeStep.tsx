"use client";
// @ts-nocheck

import { useEffect, useMemo, useRef, useState } from "react";
import StepFrame from "../_components/StepFrame";
import WizardFooter from "../_components/WizardFooter";
import { useNewProperty } from "../_store/useNewProperty";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search } from "lucide-react";

type Kind = "APARTMENT"|"HOUSE"|"STUDIO"|"COLOCATION"|"PARKING"|"BOX"|"RETAIL"|"OFFICE"|"WAREHOUSE"|"MIXED";

const TYPES: ReadonlyArray<{ k: Kind; l: string; g: "HAB"|"PARK"|"BIZ"; d?: string }> = [
  { k: "APARTMENT", l: "Appartement", g: "HAB", d: "T1 à T5 et +" },
  { k: "HOUSE", l: "Maison", g: "HAB", d: "Individuelle / mitoyenne" },
  { k: "STUDIO", l: "Studio", g: "HAB", d: "≤ 1 pièce" },
  { k: "COLOCATION", l: "Colocation", g: "HAB", d: "Chambres privatives" },
  { k: "PARKING", l: "Place de parking", g: "PARK" },
  { k: "BOX", l: "Box fermé", g: "PARK" },
  { k: "RETAIL", l: "Local commercial / Boutique", g: "BIZ" },
  { k: "OFFICE", l: "Bureaux / Tertiaire", g: "BIZ" },
  { k: "WAREHOUSE", l: "Entrepôt / Atelier / Logistique", g: "BIZ" },
  { k: "MIXED", l: "Fonds de commerce / Mixte", g: "BIZ" },
];

function computeCols(grid: HTMLElement): number {
  const w = grid.getBoundingClientRect().width;
  if (w >= 1280) return 4;
  if (w >= 1024) return 3;
  if (w >= 640) return 2;
  return 1;
}

export default function TypeStep() {
  const { draft, patch, next } = useNewProperty();
  const [group, setGroup] = useState<"ALL"|"HAB"|"PARK"|"BIZ">("ALL");
  const [q, setQ] = useState("");
  const reduced = useReducedMotion();
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => TYPES.filter(t => group==="ALL" ? true : t.g===group)
               .filter(t => q ? (t.l.toLowerCase().includes(q.toLowerCase()) || (t.d||"").toLowerCase().includes(q.toLowerCase())) : true),
    [group, q]
  );

  // Prefetch de l'étape suivante quand un type est choisi
  useEffect(() => {
    if (draft.kind) {
      router.prefetch("/app/owner/property/new");
    }
  }, [draft.kind, router]);

  // Navigation clavier (↑↓←→ + Entrée)
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (!gridRef.current) return;
      const cards = Array.from(gridRef.current.querySelectorAll<HTMLButtonElement>("[data-card='true']"));
      if (!cards.length) return;
      const cols = computeCols(gridRef.current);
      let idx = draft.kind ? cards.findIndex(c => c.dataset.key === draft.kind) : -1;
      
      if (e.key === "ArrowRight") idx = Math.min(cards.length-1, Math.max(idx,0)+1);
      if (e.key === "ArrowLeft")  idx = Math.max(0, (idx===-1?0:idx)-1);
      if (e.key === "ArrowDown")  idx = Math.min(cards.length-1, (idx===-1?0:idx)+cols);
      if (e.key === "ArrowUp")    idx = Math.max(0, (idx===-1?0:idx)-cols);
      
      if (["ArrowRight","ArrowLeft","ArrowDown","ArrowUp"].includes(e.key)) {
        const k = cards[idx]?.dataset.key as Kind | undefined;
        if (k) { 
          patch({ kind:k }); 
          requestAnimationFrame(() => {
            cards[idx]?.focus();
          });
          e.preventDefault(); 
        }
      }
      
      if (e.key === "Enter" && draft.kind) { 
        next(); 
        e.preventDefault(); 
      }
    }
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [draft.kind, patch, next]);

  return (
    <StepFrame k="TYPE">
      <h2 className="text-xl font-semibold">Étape 1 — Sélectionnez le type de bien</h2>

      {/* Filtres sticky */}
      <div className="sticky top-[calc(var(--header-height)+1rem)] z-20 -mx-4 px-4 py-3 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-t">
        <div className="flex flex-wrap items-center gap-2">
          {(["ALL","HAB","PARK","BIZ"] as const).map(g => (
            <button 
              key={g}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-all min-h-[36px] min-w-[36px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                group===g 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "hover:bg-muted text-muted-foreground"
              )}
              onClick={()=>setGroup(g)} 
              aria-pressed={group===g}
            >
              {g==="ALL"?"Tous":g==="HAB"?"Habitation":g==="PARK"?"Parking & Box":"Commercial"}
            </button>
          ))}
          <div className="ml-auto w-full sm:w-72 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              type="search" 
              inputMode="search" 
              placeholder="Rechercher un type de bien…"
              value={q} 
              onChange={(e)=>setQ(e.target.value)} 
              aria-label="Rechercher un type de bien"
              className="pl-9 rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 min-h-[44px]"
            />
          </div>
        </div>
      </div>

      {/* Grille cliquable */}
      {filtered.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <p className="text-muted-foreground mb-4">Aucun type trouvé</p>
          <button
            onClick={() => { setQ(""); setGroup("ALL"); }}
            className="text-sm text-primary hover:underline"
          >
            Effacer le filtre
          </button>
        </div>
      ) : (
        <div 
          ref={gridRef} 
          role="listbox" 
          aria-label="Types de bien"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map(t => (
              <motion.button
                key={t.k}
                data-card="true"
                data-key={t.k}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={reduced ? {} : { y: -2, scale: 1.01 }}
                whileTap={reduced ? {} : { scale: 0.98 }}
                onClick={() => patch({ kind:t.k })}
                aria-pressed={draft.kind===t.k}
                className={cn(
                  "group rounded-2xl border bg-card p-4 text-left outline-none ring-offset-background transition",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  "min-h-[120px] min-w-[120px]",
                  draft.kind===t.k ? "border-primary/70 bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:shadow-sm"
                )}
                transition={{ duration: 0.22 }}
              >
                <div className="text-[15px] font-medium">{t.l}</div>
                <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{t.d || " "}</p>
                {draft.kind===t.k && (
                  <motion.span 
                    initial={{ scale: 0, opacity: 0 }} 
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
                  >
                    Sélectionné
                  </motion.span>
                )}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      <WizardFooter
        primary="Continuer — Adresse"
        onPrimary={() => draft.kind && next()}
        disabled={!draft.kind}
        hint="Parfait, on passe à l'adresse ✨"
      />
    </StepFrame>
  );
}

