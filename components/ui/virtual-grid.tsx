"use client";

/**
 * VirtualGrid — Grille virtualisee pour les longues listes
 *
 * Utilise @tanstack/react-virtual pour ne rendre que les elements visibles.
 * Remplace les .map() complets sur les listes de biens, locataires, documents.
 *
 * Usage :
 * ```tsx
 * <VirtualGrid
 *   items={filteredProperties}
 *   estimateSize={280}
 *   columns={{ sm: 1, md: 2, lg: 3 }}
 *   renderItem={(item, index) => <PropertyCard property={item} />}
 * />
 * ```
 */

import { useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualGridProps<T> {
  items: T[];
  /** Hauteur estimee d'une ligne en pixels */
  estimateSize?: number;
  /** Nombre de colonnes par breakpoint */
  columns?: { sm?: number; md?: number; lg?: number; xl?: number };
  /** Render function pour chaque item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Nombre d'elements au-dela desquels activer la virtualisation */
  virtualizeThreshold?: number;
  /** Classes CSS pour le conteneur */
  className?: string;
  /** Gap entre les elements en pixels */
  gap?: number;
}

function useColumns(columns: VirtualGridProps<unknown>["columns"] = {}) {
  const { sm = 1, md = 2, lg = 3, xl = 3 } = columns;

  // Detecter le nombre de colonnes cote client
  if (typeof window === "undefined") return lg;

  const width = window.innerWidth;
  if (width >= 1280) return xl;
  if (width >= 1024) return lg;
  if (width >= 768) return md;
  return sm;
}

export function VirtualGrid<T>({
  items,
  estimateSize = 280,
  columns = { sm: 1, md: 2, lg: 3 },
  renderItem,
  virtualizeThreshold = 50,
  className = "",
  gap = 16,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const colCount = useColumns(columns);

  // Grouper les items en lignes
  const rows = useMemo(() => {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += colCount) {
      result.push(items.slice(i, i + colCount));
    }
    return result;
  }, [items, colCount]);

  // Si peu d'items, pas besoin de virtualiser
  if (items.length <= virtualizeThreshold) {
    return (
      <div
        className={`grid gap-4 ${className}`}
        style={{
          gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        }}
      >
        {items.map((item, index) => (
          <div key={index}>{renderItem(item, index)}</div>
        ))}
      </div>
    );
  }

  return <VirtualGridInner rows={rows} colCount={colCount} estimateSize={estimateSize} gap={gap} renderItem={renderItem} className={className} parentRef={parentRef} />;
}

function VirtualGridInner<T>({
  rows,
  colCount,
  estimateSize,
  gap,
  renderItem,
  className,
  parentRef,
}: {
  rows: T[][];
  colCount: number;
  estimateSize: number;
  gap: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className: string;
  parentRef: React.RefObject<HTMLDivElement | null>;
}) {
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan: 3,
  });

  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ maxHeight: "calc(100vh - 300px)" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          const baseIndex = virtualRow.index * colCount;
          return (
            <div
              key={virtualRow.key}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                }}
              >
                {row.map((item, colIndex) => (
                  <div key={colIndex}>
                    {renderItem(item, baseIndex + colIndex)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
