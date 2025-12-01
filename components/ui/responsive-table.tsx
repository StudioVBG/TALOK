import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
}

export function ResponsiveTable<T>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "Aucune donnée disponible",
}: ResponsiveTableProps<T>) {
  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <>
      {/* VUE DESKTOP (Tableau) - Caché sur mobile */}
      <div className="hidden md:block rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, index) => (
                <TableHead key={index} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow
                key={keyExtractor(item)}
                onClick={() => onRowClick && onRowClick(item)}
                className={cn(onRowClick && "cursor-pointer hover:bg-muted/50")}
              >
                {columns.map((col, index) => (
                  <TableCell key={index} className={col.className}>
                    {col.cell
                      ? col.cell(item)
                      : col.accessorKey
                      ? (item[col.accessorKey] as React.ReactNode)
                      : null}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* VUE MOBILE (Cartes) - Caché sur desktop */}
      <div className="md:hidden space-y-4">
        {data.map((item) => (
          <Card
            key={keyExtractor(item)}
            onClick={() => onRowClick && onRowClick(item)}
            className={cn("overflow-hidden", onRowClick && "active:scale-[0.98] transition-transform")}
          >
            <CardHeader className="bg-muted/30 p-4 border-b">
              <div className="font-medium">
                 {/* On utilise la première colonne comme titre de la carte */}
                {columns[0].cell ? columns[0].cell(item) : (item[columns[0].accessorKey!] as React.ReactNode)}
              </div>
            </CardHeader>
            <CardContent className="p-4 grid gap-2">
              {columns.slice(1).map((col, index) => (
                <div key={index} className="flex justify-between items-center py-1 border-b last:border-0 border-slate-100">
                  <span className="text-sm text-muted-foreground font-medium">{col.header}</span>
                  <div className="text-sm text-right">
                    {col.cell
                      ? col.cell(item)
                      : col.accessorKey
                      ? (item[col.accessorKey] as React.ReactNode)
                      : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

