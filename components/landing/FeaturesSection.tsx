"use client";

import { motion } from "framer-motion";
import { fadeUp, defaultViewport } from "@/lib/marketing/animations";
import { FeatureBaux } from "./FeatureBaux";
import { FeatureLoyers } from "./FeatureLoyers";
import { FeatureAutomation } from "./FeatureAutomation";

export function FeaturesSection() {
  return (
    <motion.section
      id="fonctionnalites"
      className="py-20 md:py-28"
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={defaultViewport}
    >
      <div className="container mx-auto max-w-6xl space-y-20 px-4 md:space-y-28">
        <FeatureBaux />
        <FeatureLoyers />
        <FeatureAutomation />
      </div>
    </motion.section>
  );
}
