"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check, X, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PlanFeatureGroup } from "@/types/billing";

interface PlanFeaturesProps {
  groups: PlanFeatureGroup[];
}

export function PlanFeatures({ groups }: PlanFeaturesProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggle = (category: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  if (groups.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-slate-300 mb-3">
        Fonctionnalites incluses
      </h2>
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.category);
        const includedCount = group.features.filter((f) => f.included).length;
        const totalCount = group.features.length;

        return (
          <div key={group.category} className="border border-slate-700/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(group.category)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/20 transition-colors"
              aria-expanded={isExpanded}
              aria-controls={`features-${group.category}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{group.category}</span>
                <span className="text-xs text-slate-500">
                  {includedCount}/{totalCount}
                </span>
              </div>
              <ChevronDown
                className={cn("w-4 h-4 text-slate-400 transition-transform", isExpanded && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  id={`features-${group.category}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <ul className="px-3 pb-3 space-y-1.5">
                    {group.features.map((feature) => (
                      <li key={feature.label} className="flex items-center gap-2">
                        {feature.included ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" aria-hidden="true" />
                        ) : (
                          <X className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" aria-hidden="true" />
                        )}
                        <span className={cn("text-sm", feature.included ? "text-slate-300" : "text-slate-600")}>
                          {feature.label}
                        </span>
                        {feature.tooltip && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3 h-3 text-slate-500 cursor-help" aria-hidden="true" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs">
                              <p className="text-sm">{feature.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
