"use client";

import { FeatureCard, FEATURE_CARDS, DEFAULT_IMAGES } from "./FeatureCard";

const CONFIG_KEY_MAP: Record<string, string> = {
  time: "landing_arg_time_img",
  money: "landing_arg_money_img",
  contract: "landing_arg_contract_img",
  sleep: "landing_arg_sleep_img",
};

interface ArgumentsSectionProps {
  images?: Record<string, string>;
}

export function ArgumentsSection({ images }: ArgumentsSectionProps) {
  return (
    <section className="bg-[#1D4ED8] py-6">
      {FEATURE_CARDS.map((feature) => {
        const configKey = CONFIG_KEY_MAP[feature.id];
        const imageSrc = (configKey && images?.[configKey]) || DEFAULT_IMAGES[feature.id] || "";
        return (
          <FeatureCard
            key={feature.id}
            feature={feature}
            imageSrc={imageSrc}
          />
        );
      })}
    </section>
  );
}
