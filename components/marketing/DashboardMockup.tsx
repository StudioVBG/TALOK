"use client"

import { motion, useInView } from "framer-motion"
import { useRef, useState, useEffect } from "react"
import { use3DTilt, useCountUp, blurIn } from "@/components/marketing/hooks"

const ease = [0.22, 1, 0.36, 1] as const

const floatBadge = (delay: number) => ({
  animate: {
    y: [-8, 0, -8],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const, delay },
  },
})

const badgeEntrance = (delay: number) => ({
  hidden: { opacity: 0, scale: 0.6, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: { duration: 0.5, delay, ease },
  },
})

const lineReveal = (i: number) => ({
  hidden: { opacity: 0, x: -10, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.4, delay: 0.3 + i * 0.08, ease },
  },
})

/* Count-up display for KPIs */
function KpiValue({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const { ref, display } = useCountUp(target, 1.5, { prefix, suffix })
  return <span ref={ref}>{display}</span>
}

const kpis = [
  { label: "Revenus du mois", target: 4850, suffix: " €", color: "#2563EB" },
  { label: "Biens gérés", target: 6, suffix: "", color: "#22C55E" },
  { label: "Baux actifs", target: 5, suffix: "", color: "#F59E0B" },
]

const leases = [
  { name: "Apt T3 · Fort-de-France", tenant: "J. Dupont", amount: "1 250 €", status: "Actif", color: "#22C55E" },
  { name: "Studio · Le Lamentin", tenant: "M. Laurent", amount: "650 €", status: "Signé", color: "#2563EB" },
  { name: "Maison T4 · Schœlcher", tenant: "P. Bernard", amount: "1 450 €", status: "Actif", color: "#22C55E" },
  { name: "T2 · Ducos", tenant: "A. Celmar", amount: "750 €", status: "En attente", color: "#F59E0B" },
]

const sidebarItems = ["Tableau de bord", "Mes biens", "Mes baux", "Paiements", "Documents", "Comptabilité"]

const chartPath = "M0,32 L17,28 L34,30 L51,24 L68,26 L85,20 L102,22 L119,16 L136,18 L153,12 L170,14 L187,8 L200,6"

export function DashboardMockup() {
  const tilt = use3DTilt(5)
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInView = useInView(chartRef, { once: true })

  return (
    <div className="relative mx-auto w-full max-w-[520px]">
      {/* Main dashboard card with 3D tilt */}
      <motion.div
        ref={tilt.ref}
        variants={{
          hidden: { opacity: 0, scale: 0.95, filter: "blur(10px)" },
          visible: {
            opacity: 1,
            scale: 1,
            filter: "blur(0px)",
            transition: { duration: 0.7, delay: 0.2, ease },
          },
        }}
        style={{
          rotateX: tilt.rotateX,
          rotateY: tilt.rotateY,
          transformPerspective: 1000,
        }}
        animate={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
        transition={{ type: "spring" as const, stiffness: 200, damping: 20 }}
        className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50"
      >
        <div className="flex">
          {/* Sidebar */}
          <div className="hidden w-[140px] shrink-0 bg-[#1E293B] p-3 sm:block">
            <div className="mb-4 flex items-center">
              <img src="/images/talok-logo-horizontal.png" alt="TALOK" className="h-7 w-auto object-contain" />
            </div>
            {sidebarItems.map((item, i) => (
              <motion.div
                key={item}
                variants={lineReveal(i)}
                className={`mb-1 rounded-md px-2 py-1.5 text-[9px] ${
                  i === 0
                    ? "bg-white/10 font-medium text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {item}
              </motion.div>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-3 sm:p-4">
            <motion.div variants={lineReveal(0)} className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-800">Tableau de bord</span>
              <span className="text-[9px] text-slate-400">Mars 2026</span>
            </motion.div>

            {/* KPI Cards with count-up */}
            <div className="mb-3 grid grid-cols-3 gap-2">
              {kpis.map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  variants={lineReveal(i + 1)}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-2"
                >
                  <div className="text-[8px] text-slate-500">{kpi.label}</div>
                  <div className="text-[13px] font-bold" style={{ color: kpi.color }}>
                    <KpiValue target={kpi.target} suffix={kpi.suffix} />
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Mini chart with path draw animation */}
            <motion.div ref={chartRef} variants={lineReveal(4)} className="mb-3 rounded-lg border border-slate-100 bg-slate-50 p-2">
              <div className="mb-1 text-[8px] font-medium text-slate-500">Revenus 12 mois</div>
              <svg viewBox="0 0 200 40" className="h-8 w-full">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={`${chartPath} L200,40 L0,40Z`}
                  fill="url(#chartGrad)"
                  opacity={chartInView ? 1 : 0}
                />
                <motion.path
                  d={chartPath}
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={chartInView ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: 1.2, delay: 0.5, ease }}
                />
              </svg>
            </motion.div>

            {/* Lease list */}
            <motion.div variants={lineReveal(5)} className="text-[8px] font-medium text-slate-500 mb-1">
              Baux récents
            </motion.div>
            {leases.map((lease, i) => (
              <motion.div
                key={lease.name}
                variants={lineReveal(6 + i)}
                className="flex items-center justify-between border-b border-slate-50 py-1.5 last:border-0"
              >
                <div>
                  <div className="text-[9px] font-medium text-slate-700">{lease.name}</div>
                  <div className="text-[8px] text-slate-400">{lease.tenant}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-medium text-slate-600">{lease.amount}</span>
                  <motion.span
                    animate={lease.status === "Actif" ? { opacity: [0.7, 1, 0.7] } : undefined}
                    transition={lease.status === "Actif" ? { duration: 2, repeat: Infinity } : undefined}
                    className="rounded-full px-1.5 py-0.5 text-[7px] font-medium text-white"
                    style={{ backgroundColor: lease.color }}
                  >
                    {lease.status}
                  </motion.span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Floating badges — blur-in entrance + float loop */}
      <motion.div
        variants={badgeEntrance(0.8)}
        initial="hidden"
        animate="visible"
        className="absolute -right-2 -top-2 z-10 sm:-right-4 sm:-top-3"
      >
        <motion.div
          {...floatBadge(0)}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 shadow-lg shadow-emerald-100 ring-1 ring-emerald-100"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-100 text-[9px]">✓</span>
          Bail signé
        </motion.div>
      </motion.div>

      <motion.div
        variants={badgeEntrance(1.2)}
        initial="hidden"
        animate="visible"
        className="absolute -bottom-2 -left-2 z-10 sm:-bottom-3 sm:-left-4"
      >
        <motion.div
          {...floatBadge(1)}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-blue-700 shadow-lg shadow-blue-100 ring-1 ring-blue-100"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[9px]">✓</span>
          35€ reçu
        </motion.div>
      </motion.div>

      <motion.div
        variants={badgeEntrance(1.6)}
        initial="hidden"
        animate="visible"
        className="absolute -left-2 top-12 z-10 sm:-left-6 sm:top-16"
      >
        <motion.div
          {...floatBadge(2)}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-amber-700 shadow-lg shadow-amber-100 ring-1 ring-amber-100"
        >
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-100 text-[9px]">✓</span>
          Relance envoyée
        </motion.div>
      </motion.div>
    </div>
  )
}
