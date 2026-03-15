import { describe, expect, it } from "vitest";

import { resolveCurrentPlan } from "@/lib/subscriptions/resolve-current-plan";

describe("resolveCurrentPlan", () => {
  it("préfère le plan payant résolu côté abonnement", () => {
    expect(resolveCurrentPlan("confort", "starter")).toBe("confort");
  });

  it("utilise le fallback serveur quand le client retombe sur gratuit", () => {
    expect(resolveCurrentPlan("gratuit", "starter")).toBe("starter");
  });

  it("revient sur gratuit si aucun plan valide n'est disponible", () => {
    expect(resolveCurrentPlan(null, "inconnu")).toBe("gratuit");
  });
});
