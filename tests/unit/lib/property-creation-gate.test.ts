import { describe, expect, it } from "vitest";

import { resolvePropertyCreationGate } from "@/lib/subscriptions/property-creation-gate";

describe("resolvePropertyCreationGate", () => {
  it("garde le CTA visible pour starter meme si le hook remonte false", () => {
    expect(
      resolvePropertyCreationGate({
        currentPlan: "starter",
        usedProperties: 3,
        canAddFromUsageLimit: false,
        subscriptionLoading: false,
      })
    ).toBe(true);
  });

  it("cache le CTA direct pour le forfait gratuit au quota atteint", () => {
    expect(
      resolvePropertyCreationGate({
        currentPlan: "gratuit",
        usedProperties: 1,
        canAddFromUsageLimit: false,
        subscriptionLoading: false,
      })
    ).toBe(false);
  });

  it("laisse le CTA visible pendant le chargement", () => {
    expect(
      resolvePropertyCreationGate({
        currentPlan: "gratuit",
        usedProperties: 1,
        canAddFromUsageLimit: false,
        subscriptionLoading: true,
      })
    ).toBe(true);
  });
});
