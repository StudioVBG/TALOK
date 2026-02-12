import { describe, it, expect } from "vitest";

/**
 * Tests pour la logique de progression du bail.
 * Vérifie que le calcul des étapes correspond aux statuts attendus.
 * Réplique la logique du composant LeaseProgressTracker sans dépendance React.
 */

type LeaseProgressStatus =
  | "draft"
  | "pending_signature"
  | "partially_signed"
  | "fully_signed"
  | "active"
  | "terminated"
  | "archived"
  | "cancelled";

interface ProgressStep {
  id: string;
  isDone: boolean;
  isInProgress: boolean;
}

function computeLeaseProgress(
  status: LeaseProgressStatus,
  hasSignedEdl: boolean,
  hasPaidInitial: boolean
): { steps: ProgressStep[]; percent: number } {
  const steps: ProgressStep[] = [
    {
      id: "signature",
      isDone: ["fully_signed", "active", "terminated", "archived"].includes(status),
      isInProgress: ["pending_signature", "partially_signed"].includes(status),
    },
    {
      id: "edl",
      isDone: hasSignedEdl,
      isInProgress: (status === "fully_signed" || status === "active") && !hasSignedEdl,
    },
    {
      id: "payment",
      isDone: hasPaidInitial,
      isInProgress:
        (status === "fully_signed" && hasSignedEdl && !hasPaidInitial) ||
        (status === "active" && !hasPaidInitial),
    },
    {
      id: "keys",
      isDone: status === "active" && hasSignedEdl && hasPaidInitial,
      isInProgress:
        (status === "active" && (!hasSignedEdl || !hasPaidInitial)) ||
        (hasSignedEdl && hasPaidInitial && status === "fully_signed"),
    },
  ];

  const completedSteps = steps.filter((s) => s.isDone).length;
  const percent = Math.round((completedSteps / steps.length) * 100);

  return { steps, percent };
}

describe("Lease Progress Logic", () => {
  it("draft => 0% — aucune étape complétée", () => {
    const { percent, steps } = computeLeaseProgress("draft", false, false);
    expect(percent).toBe(0);
    expect(steps.every((s) => !s.isDone)).toBe(true);
  });

  it("pending_signature => 0%, signature en cours", () => {
    const { percent, steps } = computeLeaseProgress("pending_signature", false, false);
    expect(percent).toBe(0);
    expect(steps[0].isInProgress).toBe(true);
    expect(steps[0].isDone).toBe(false);
  });

  it("partially_signed => 0%, signature en cours", () => {
    const { percent, steps } = computeLeaseProgress("partially_signed", false, false);
    expect(percent).toBe(0);
    expect(steps[0].isInProgress).toBe(true);
  });

  it("fully_signed sans EDL => 25%, EDL en cours", () => {
    const { percent, steps } = computeLeaseProgress("fully_signed", false, false);
    expect(percent).toBe(25);
    expect(steps[0].isDone).toBe(true); // signature
    expect(steps[1].isInProgress).toBe(true); // EDL en cours
    expect(steps[1].isDone).toBe(false);
  });

  it("fully_signed avec EDL signé => 50%, paiement en cours", () => {
    const { percent, steps } = computeLeaseProgress("fully_signed", true, false);
    expect(percent).toBe(50);
    expect(steps[0].isDone).toBe(true); // signature
    expect(steps[1].isDone).toBe(true); // EDL
    expect(steps[2].isInProgress).toBe(true); // paiement en cours
  });

  it("fully_signed avec EDL et paiement => 75%, remise des clés en cours", () => {
    const { percent, steps } = computeLeaseProgress("fully_signed", true, true);
    expect(percent).toBe(75);
    expect(steps[3].isInProgress).toBe(true); // remise des clés
    expect(steps[3].isDone).toBe(false);
  });

  it("active avec EDL et paiement => 100%, tout complété", () => {
    const { percent, steps } = computeLeaseProgress("active", true, true);
    expect(percent).toBe(100);
    expect(steps.every((s) => s.isDone)).toBe(true);
    expect(steps.every((s) => !s.isInProgress)).toBe(true);
  });

  it("active sans EDL => 25%, EDL en cours", () => {
    const { percent, steps } = computeLeaseProgress("active", false, false);
    expect(percent).toBe(25);
    expect(steps[0].isDone).toBe(true);
    expect(steps[1].isInProgress).toBe(true);
  });

  it("active sans paiement mais avec EDL => 50%, paiement en cours", () => {
    const { percent, steps } = computeLeaseProgress("active", true, false);
    expect(percent).toBe(50);
    expect(steps[2].isInProgress).toBe(true);
  });

  it("terminated => signature done, reste dépend des données", () => {
    const { percent, steps } = computeLeaseProgress("terminated", true, true);
    expect(percent).toBe(75); // Remise des clés n'est pas "done" car status !== active
    expect(steps[0].isDone).toBe(true);
    expect(steps[1].isDone).toBe(true);
    expect(steps[2].isDone).toBe(true);
    expect(steps[3].isDone).toBe(false);
  });

  it("les étapes ne peuvent être isDone et isInProgress en même temps", () => {
    const statuses: LeaseProgressStatus[] = [
      "draft", "pending_signature", "partially_signed",
      "fully_signed", "active", "terminated",
    ];
    for (const status of statuses) {
      for (const edl of [true, false]) {
        for (const paid of [true, false]) {
          const { steps } = computeLeaseProgress(status, edl, paid);
          for (const step of steps) {
            if (step.isDone && step.isInProgress) {
              throw new Error(
                `Step ${step.id} is both done AND in progress for status=${status}, edl=${edl}, paid=${paid}`
              );
            }
          }
        }
      }
    }
  });
});
