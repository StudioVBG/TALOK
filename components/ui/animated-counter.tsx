"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useSpring } from "framer-motion";
import { formatCurrency } from "@/lib/helpers/format";

interface AnimatedCounterProps {
  value: number;
  type?: "currency" | "number";
  className?: string;
}

export function AnimatedCounter({ value, type = "number", className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { damping: 30, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [motionValue, isInView, value]);

  useEffect(() => {
    springValue.on("change", (latest) => {
      if (ref.current) {
        if (type === "currency") {
          ref.current.textContent = formatCurrency(latest);
        } else {
          ref.current.textContent = Math.round(latest).toLocaleString("fr-FR");
        }
      }
    });
  }, [springValue, type]);

  return <span ref={ref} className={className} />;
}
