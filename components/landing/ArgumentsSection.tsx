"use client";

import { FeatureCard, FEATURE_CARDS, DEFAULT_IMAGES } from "./FeatureCard";

export function ArgumentsSection() {
  return (
    <section className="bg-[#1D4ED8] py-6">
      {FEATURE_CARDS.map((feature) => (
        <FeatureCard
          key={feature.id}
          feature={feature}
          imageSrc={DEFAULT_IMAGES[feature.id] ?? ""}
        />
      ))}
    </section>
  );
}
