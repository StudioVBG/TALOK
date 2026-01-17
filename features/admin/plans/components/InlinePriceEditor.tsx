"use client";

/**
 * InlinePriceEditor component
 * Allows inline editing of prices with double-click
 * Extracted from app/admin/plans/page.tsx
 */

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { centsToEuros, eurosToCents } from "../helpers";

interface InlinePriceEditorProps {
  value: number;
  onChange: (cents: number) => void;
  className?: string;
}

export function InlinePriceEditor({
  value,
  onChange,
  className,
}: InlinePriceEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(centsToEuros(value).toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(centsToEuros(value).toString());
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const euros = parseFloat(localValue) || 0;
    onChange(eurosToCents(euros));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setLocalValue(centsToEuros(value).toString());
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="relative inline-flex items-baseline">
        <Input
          ref={inputRef}
          type="number"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-20 h-8 text-2xl font-bold pr-6 text-right"
          min={0}
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-lg font-bold">
          €
        </span>
      </div>
    );
  }

  return (
    <span
      className={cn(
        "cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors",
        className
      )}
      onDoubleClick={() => setIsEditing(true)}
      title="Double-cliquez pour modifier"
    >
      {centsToEuros(value)}€
    </span>
  );
}
