"use client";

import { FeatureBaux } from "./FeatureBaux";
import { FeatureLoyers } from "./FeatureLoyers";
import { FeatureAutomation } from "./FeatureAutomation";

export function FeaturesSection() {
  return (
    <section id="fonctionnalites" className="py-20 md:py-28">
      <div className="container mx-auto max-w-6xl space-y-20 px-4 md:space-y-28">
        <FeatureBaux />
        <FeatureLoyers />
        <FeatureAutomation />
      </div>
    </section>
  );
}
