export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[-']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

export function fuzzyMatch(a: string, b: string): number {
  if (!a || !b) return 0
  const na = normalizeString(a), nb = normalizeString(b)
  if (na === nb) return 1.0
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1.0
  const score = 1 - levenshtein(na, nb) / maxLen
  if (na.includes(nb) || nb.includes(na)) return Math.min(1, score + 0.15)
  if (na.split(' ')[0] === nb.split(' ')[0]) return Math.min(1, score + 0.1)
  return Math.max(0, score)
}
