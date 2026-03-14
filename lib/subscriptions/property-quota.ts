export interface PropertyQuotaSummaryInput {
  visibleCount: number;
  totalCount: number;
  limit: number;
  hasScopedView: boolean;
}

export interface PropertyQuotaSummary {
  effectiveTotalCount: number;
  limitLabel: string;
  usageLabel: string;
  showScopedHint: boolean;
  scopedHint: string | null;
}

export function buildPropertyQuotaSummary({
  visibleCount,
  totalCount,
  limit,
  hasScopedView,
}: PropertyQuotaSummaryInput): PropertyQuotaSummary {
  const effectiveTotalCount = Math.max(visibleCount, totalCount);
  const limitLabel = limit === -1 ? "Illimité" : `${limit}`;
  const usageLabel =
    limit === -1 ? `${effectiveTotalCount} bien${effectiveTotalCount > 1 ? "s" : ""}` : `${effectiveTotalCount}/${limit}`;
  const showScopedHint = hasScopedView && effectiveTotalCount !== visibleCount;
  const scopedHint = showScopedHint
    ? `${visibleCount} bien${visibleCount > 1 ? "s" : ""} visible${visibleCount > 1 ? "s" : ""} sur ${effectiveTotalCount} compté${effectiveTotalCount > 1 ? "s" : ""} pour le quota global.`
    : null;

  return {
    effectiveTotalCount,
    limitLabel,
    usageLabel,
    showScopedHint,
    scopedHint,
  };
}
