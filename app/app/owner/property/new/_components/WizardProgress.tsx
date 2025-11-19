"use client";

import { motion } from "framer-motion";
import { useNewProperty } from "../_store/useNewProperty";

export default function WizardProgress() {
  const { mode, step } = useNewProperty();
  const flow = mode === "FAST"
    ? ["TYPE","ADDRESS","PHOTOS","SUMMARY"]
    : ["TYPE","ADDRESS","DETAILS","ROOMS","PHOTOS","FEATURES","PUBLISH","SUMMARY"];
  const idx = Math.max(0, flow.indexOf(step)) + 1;
  const pct = Math.round((idx / flow.length) * 100);

  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-full rounded-full bg-muted">
        <motion.div
          className="h-2 rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap font-medium">
        Étape {idx} sur {flow.length}
      </span>
    </div>
  );
}

