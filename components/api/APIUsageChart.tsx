"use client";

interface APIUsageChartProps {
  data: { date: string; count: number }[];
}

/**
 * Simple bar chart showing daily API usage.
 * Uses pure CSS — no chart library dependency.
 */
export function APIUsageChart({ data }: APIUsageChartProps) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1 h-32">
        {data.map((d) => {
          const height = Math.max((d.count / maxCount) * 100, 2);
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center justify-end group"
            >
              <div className="relative w-full">
                <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {d.count}
                </div>
                <div
                  className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                  style={{ height: `${height}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {data.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i === 0 || i === data.length - 1 ? (
              <span className="text-[10px] text-muted-foreground">
                {new Date(d.date).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
