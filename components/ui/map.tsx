"use client";

import { useRef, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DottedMap from "dotted-map";
import Image from "next/image";
import { useTheme } from "next-themes";

export interface MapDot {
  start: { lat: number; lng: number; label?: string };
  end: { lat: number; lng: number; label?: string; meta?: string; labelBelow?: boolean };
}

interface MapProps {
  dots?: MapDot[];
  lineColor?: string;
  showLabels?: boolean;
  animationDuration?: number;
  loop?: boolean;
  className?: string;
  forceDark?: boolean;
}

export function WorldMap({
  dots = [],
  lineColor = "#0ea5e9",
  showLabels = true,
  animationDuration = 2,
  loop = true,
  className,
  forceDark = false,
}: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredDot, setHoveredDot] = useState<{ label: string; meta?: string } | null>(null);
  const { theme } = useTheme();

  const isDark = forceDark || theme === "dark";

  const map = useMemo(
    () => new DottedMap({ height: 100, grid: "diagonal" }),
    []
  );

  const svgMap = useMemo(
    () =>
      map.getSVG({
        radius: 0.22,
        color: isDark ? "#FFFFFF30" : "#00000020",
        shape: "circle",
        backgroundColor: isDark ? "black" : "white",
      }),
    [map, isDark]
  );

  const projectPoint = (lat: number, lng: number) => {
    const pin = map.getPin({ lat, lng });
    if (!pin) return { x: 0, y: 0 };
    return { x: pin.x, y: pin.y };
  };

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 10;
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  const staggerDelay = 0.3;
  const totalAnimationTime = dots.length * staggerDelay + animationDuration;
  const pauseTime = 2;
  const fullCycleDuration = totalAnimationTime + pauseTime;

  return (
    <div className={`w-full aspect-[198/100] relative overflow-hidden ${className ?? ""}`}>
      <Image
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="h-full w-full [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)] pointer-events-none select-none absolute inset-0"
        alt="world map"
        height="100"
        width="198"
        draggable={false}
        priority
        style={{ objectFit: "fill" }}
      />
      <svg
        ref={svgRef}
        viewBox="0 0 198 100"
        className="w-full h-full absolute inset-0 pointer-events-auto select-none"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="5%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="95%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>

          <filter id="glow">
            <feMorphology operator="dilate" radius="0.15" />
            <feGaussianBlur stdDeviation="0.3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {dots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);

          const startTime = (i * staggerDelay) / fullCycleDuration;
          const endTime =
            (i * staggerDelay + animationDuration) / fullCycleDuration;
          const resetTime = totalAnimationTime / fullCycleDuration;

          return (
            <g key={`path-group-${i}`}>
              <motion.path
                d={createCurvedPath(startPoint, endPoint)}
                fill="none"
                stroke="url(#path-gradient)"
                strokeWidth="0.25"
                initial={{ pathLength: 0 }}
                animate={
                  loop
                    ? { pathLength: [0, 0, 1, 1, 0] }
                    : { pathLength: 1 }
                }
                transition={
                  loop
                    ? {
                        duration: fullCycleDuration,
                        times: [0, startTime, endTime, resetTime, 1],
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 0,
                      }
                    : {
                        duration: animationDuration,
                        delay: i * staggerDelay,
                        ease: "easeInOut",
                      }
                }
              />

              {loop && (
                <motion.circle
                  r="1"
                  fill={lineColor}
                  initial={{ offsetDistance: "0%", opacity: 0 }}
                  animate={{
                    offsetDistance: [null, "0%", "100%", "100%", "100%"],
                    opacity: [0, 0, 1, 0, 0],
                  }}
                  transition={{
                    duration: fullCycleDuration,
                    times: [0, startTime, endTime, resetTime, 1],
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 0,
                  }}
                  style={{
                    offsetPath: `path('${createCurvedPath(startPoint, endPoint)}')`,
                  }}
                />
              )}
            </g>
          );
        })}

        {dots.map((dot, i) => {
          const startPoint = projectPoint(dot.start.lat, dot.start.lng);
          const endPoint = projectPoint(dot.end.lat, dot.end.lng);

          return (
            <g key={`points-group-${i}`}>
              {/* Start point (Paris) — only render label for first dot to avoid duplicates */}
              <g key={`start-${i}`}>
                <motion.g
                  onHoverStart={() =>
                    setHoveredDot({ label: dot.start.label || "Origine" })
                  }
                  onHoverEnd={() => setHoveredDot(null)}
                  className="cursor-pointer"
                  whileHover={{ scale: 1.2 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <circle
                    cx={startPoint.x}
                    cy={startPoint.y}
                    r="0.8"
                    fill={lineColor}
                    filter="url(#glow)"
                  />
                  <circle
                    cx={startPoint.x}
                    cy={startPoint.y}
                    r="0.8"
                    fill={lineColor}
                    opacity="0.5"
                  >
                    <animate attributeName="r" from="0.8" to="3" dur="2s" begin="0s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="2s" begin="0s" repeatCount="indefinite" />
                  </circle>
                </motion.g>

                {showLabels && dot.start.label && i === 0 && (
                  <motion.g
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    className="pointer-events-none"
                  >
                    <foreignObject x={startPoint.x - 12} y={startPoint.y - 8} width="24" height="7">
                      <div className="flex items-center justify-center h-full">
                        <span className={`text-[3px] font-semibold px-[2px] py-[0.5px] rounded-sm ${isDark ? "bg-white/95 text-black" : "bg-white/90 text-black"}`}>
                          {dot.start.label}
                        </span>
                      </div>
                    </foreignObject>
                  </motion.g>
                )}
              </g>

              {/* End point (DROM) */}
              <g key={`end-${i}`}>
                <motion.g
                  onHoverStart={() =>
                    setHoveredDot({
                      label: dot.end.label || "Destination",
                      meta: dot.end.meta,
                    })
                  }
                  onHoverEnd={() => setHoveredDot(null)}
                  className="cursor-pointer"
                  whileHover={{ scale: 1.3 }}
                  transition={{ type: "spring", stiffness: 400, damping: 10 }}
                >
                  <circle cx={endPoint.x} cy={endPoint.y} r="1.2" fill={lineColor} filter="url(#glow)" />
                  <circle cx={endPoint.x} cy={endPoint.y} r="1.2" fill={lineColor} opacity="0.5">
                    <animate attributeName="r" from="1.2" to="4" dur="2s" begin={`${0.3 * i}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="2s" begin={`${0.3 * i}s`} repeatCount="indefinite" />
                  </circle>
                </motion.g>

                {showLabels && dot.end.label && (
                  <motion.g
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 * i + 0.5, duration: 0.5 }}
                    className="pointer-events-none"
                  >
                    <foreignObject
                      x={endPoint.x - 12}
                      y={dot.end.labelBelow ? endPoint.y + 2 : endPoint.y - 7}
                      width="24"
                      height="6"
                    >
                      <div className="flex items-center justify-center h-full">
                        <span className="text-[2.5px] font-bold text-[#60A5FA] whitespace-nowrap">
                          {dot.end.label}
                        </span>
                      </div>
                    </foreignObject>
                  </motion.g>
                )}
              </g>
            </g>
          );
        })}
      </svg>

      {/* Tooltip enrichi */}
      <AnimatePresence>
        {hoveredDot && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className={`absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-3 rounded-xl text-sm font-medium backdrop-blur-md shadow-lg z-50 border ${
              isDark
                ? "bg-white/95 text-black border-gray-300"
                : "bg-white/95 text-black border-slate-200"
            }`}
          >
            <div className="font-bold text-[#1B2A6B]">{hoveredDot.label}</div>
            {hoveredDot.meta && (
              <div className="text-xs text-slate-500 mt-0.5">{hoveredDot.meta}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
