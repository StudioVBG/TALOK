"use client";

import { FeatureCard, FEATURE_CARDS, DEFAULT_IMAGES } from "./FeatureCard";

interface ArgumentsSectionProps {
  images?: Record<string, string>;
}

export function ArgumentsSection({ images }: ArgumentsSectionProps) {
  return (
    <section className="bg-[#1D4ED8] py-24 overflow-visible">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        {/* Section title */}
        <div className="text-center mb-16">
          <h2
            className="text-3xl md:text-4xl lg:text-[44px] font-extrabold text-white leading-tight mb-4"
            style={{ fontFamily: "Manrope, sans-serif" }}
          >
            Pourquoi les propriétaires choisissent Talok
          </h2>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            Tout ce dont vous avez besoin pour gérer vos locations est dans un seul endroit.
          </p>
        </div>

        {/* Cards */}
        <div className="space-y-20 md:space-y-24">
          {FEATURE_CARDS.map((feature, index) => {
            const imageSrc =
              images?.[feature.configKey] ||
              DEFAULT_IMAGES[feature.id] ||
              "";
            return (
              <FeatureCard
                key={feature.id}
                feature={feature}
                imageSrc={imageSrc}
                index={index}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}
