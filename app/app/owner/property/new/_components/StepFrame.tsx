"use client";

import { ReactNode } from "react";

interface StepFrameProps {
  k: string;
  children: ReactNode;
}

export default function StepFrame({ k, children }: StepFrameProps) {
  return (
    <div className="space-y-6" data-step={k}>
      {children}
    </div>
  );
}

