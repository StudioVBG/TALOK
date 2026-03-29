"use client"

import { motion } from "framer-motion"

const ease = [0.22, 1, 0.36, 1] as const

const lineIn = (i: number) => ({
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay: i * 0.08, ease },
  },
})

/* ─── 1. Contract + Signature ─── */
export function ContractMockup() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative mx-auto w-full max-w-[380px]"
    >
      {/* Document */}
      <motion.div
        variants={lineIn(0)}
        className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-[#2563EB]" />
          <div className="text-[10px] font-bold text-slate-700">Bail de location — T3 meublé</div>
        </div>
        {/* Fake doc lines */}
        {[100, 85, 92, 70, 88, 60].map((w, i) => (
          <motion.div
            key={i}
            variants={lineIn(i + 1)}
            className="mb-1.5 h-1.5 rounded-full bg-slate-100"
            style={{ width: `${w}%` }}
          />
        ))}
        <motion.div variants={lineIn(7)} className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
          <div>
            <div className="text-[8px] text-slate-400">Propriétaire</div>
            <div className="mt-0.5 h-4 w-16 rounded bg-slate-100" />
          </div>
          <div>
            <div className="text-[8px] text-slate-400">Locataire</div>
            <div className="mt-0.5 font-[cursive] text-[11px] text-[#2563EB]">M. Laurent</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Phone with signature overlay */}
      <motion.div
        variants={lineIn(4)}
        className="absolute -bottom-4 -right-2 w-[120px] rounded-xl border-2 border-slate-200 bg-white p-2 shadow-xl sm:-right-6"
      >
        <div className="mb-1 text-center text-[7px] font-medium text-slate-500">Signer ici</div>
        <div className="h-10 rounded-lg bg-slate-50 flex items-center justify-center">
          <svg width="60" height="20" viewBox="0 0 60 20" fill="none">
            <path d="M5,15 C10,5 20,5 25,10 S40,15 55,5" stroke="#2563EB" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <motion.div
          variants={lineIn(6)}
          className="mt-1.5 rounded-md bg-[#22C55E] py-1 text-center text-[7px] font-bold text-white"
        >
          ✓ Signé
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/* ─── 2. Payments Dashboard ─── */
export function PaymentsMockup() {
  const payments = [
    { name: "J. Dupont", amount: "1 250 €", status: "Payé", color: "#22C55E" },
    { name: "M. Laurent", amount: "650 €", status: "Payé", color: "#22C55E" },
    { name: "P. Bernard", amount: "1 450 €", status: "En attente", color: "#F59E0B" },
    { name: "A. Celmar", amount: "750 €", status: "Payé", color: "#22C55E" },
  ]

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative mx-auto w-full max-w-[380px]"
    >
      <motion.div variants={lineIn(0)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-700">Paiements — Mars 2026</div>
          <div className="rounded-full bg-[#22C55E]/10 px-2 py-0.5 text-[8px] font-medium text-[#22C55E]">
            3/4 reçus
          </div>
        </div>

        {/* Revenue bar */}
        <motion.div variants={lineIn(1)} className="mb-3 rounded-lg bg-slate-50 p-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[8px] text-slate-400">Total encaissé</div>
              <div className="text-[14px] font-bold text-[#2563EB]">3 150 €</div>
            </div>
            <div className="text-right">
              <div className="text-[8px] text-slate-400">Attendu</div>
              <div className="text-[11px] font-medium text-slate-600">4 100 €</div>
            </div>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <motion.div
              variants={{
                hidden: { width: 0 },
                visible: { width: "77%", transition: { duration: 0.8, delay: 0.5 } },
              }}
              className="h-full rounded-full bg-[#2563EB]"
            />
          </div>
        </motion.div>

        {/* Payment list */}
        {payments.map((p, i) => (
          <motion.div
            key={p.name}
            variants={lineIn(i + 2)}
            className="flex items-center justify-between border-b border-slate-50 py-1.5 last:border-0"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[7px] font-bold text-slate-500">
                {p.name.split(" ").map(n => n[0]).join("")}
              </div>
              <span className="text-[9px] text-slate-600">{p.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-medium text-slate-700">{p.amount}</span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[7px] font-medium text-white"
                style={{ backgroundColor: p.color }}
              >
                {p.status}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Notification badge */}
      <motion.div
        variants={lineIn(6)}
        className="absolute -right-2 -top-2 rounded-lg bg-white px-2.5 py-1.5 shadow-lg ring-1 ring-slate-100 sm:-right-4"
      >
        <div className="text-[8px] font-medium text-[#22C55E]">✓ Reçu envoyé automatiquement</div>
      </motion.div>
    </motion.div>
  )
}

/* ─── 3. EDL (État des lieux) ─── */
export function EDLMockup() {
  const rooms = [
    { name: "Salon", status: "Bon", color: "#22C55E", photos: 4 },
    { name: "Cuisine", status: "Bon", color: "#22C55E", photos: 6 },
    { name: "Chambre 1", status: "Correct", color: "#F59E0B", photos: 3 },
    { name: "Salle de bain", status: "Bon", color: "#22C55E", photos: 5 },
  ]

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative mx-auto w-full max-w-[380px]"
    >
      <motion.div variants={lineIn(0)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-700">État des lieux — Entrée</div>
          <div className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[8px] font-medium text-[#2563EB]">
            4/6 pièces
          </div>
        </div>

        {rooms.map((room, i) => (
          <motion.div
            key={room.name}
            variants={lineIn(i + 1)}
            className="mb-2 rounded-lg border border-slate-100 p-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: room.color }}
                />
                <span className="text-[9px] font-medium text-slate-700">{room.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[7px] text-slate-400">{room.photos} photos</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[7px] font-medium text-white"
                  style={{ backgroundColor: room.color }}
                >
                  {room.status}
                </span>
              </div>
            </div>
            {/* Mini photo thumbnails */}
            <div className="mt-1.5 flex gap-1">
              {Array.from({ length: Math.min(room.photos, 4) }).map((_, j) => (
                <div
                  key={j}
                  className="h-5 w-7 rounded bg-slate-100"
                />
              ))}
              {room.photos > 4 && (
                <div className="flex h-5 w-7 items-center justify-center rounded bg-slate-50 text-[6px] text-slate-400">
                  +{room.photos - 4}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        <motion.div variants={lineIn(5)} className="mt-2 flex gap-2">
          <div className="flex-1 rounded-md bg-slate-50 p-1.5 text-center">
            <div className="text-[7px] text-slate-400">Compteur eau</div>
            <div className="text-[9px] font-bold text-slate-700">1 234 m³</div>
          </div>
          <div className="flex-1 rounded-md bg-slate-50 p-1.5 text-center">
            <div className="text-[7px] text-slate-400">Compteur élec</div>
            <div className="text-[9px] font-bold text-slate-700">5 678 kWh</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Signature badge */}
      <motion.div
        variants={lineIn(6)}
        className="absolute -bottom-3 -left-2 rounded-lg bg-white px-2.5 py-1.5 shadow-lg ring-1 ring-slate-100 sm:-left-4"
      >
        <div className="text-[8px] font-medium text-[#22C55E]">✓ Signé par les deux parties</div>
      </motion.div>
    </motion.div>
  )
}

/* ─── 4. Accounting / Comptabilité ─── */
export function AccountingMockup() {
  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]
  const revenues = [38, 42, 40, 45, 43, 48, 46, 50, 47, 52, 48, 55]
  const expenses = [12, 15, 10, 18, 14, 12, 16, 13, 20, 14, 11, 15]

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      className="relative mx-auto w-full max-w-[380px]"
    >
      <motion.div variants={lineIn(0)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[10px] font-bold text-slate-700">Comptabilité — 2026</div>
          <motion.div
            variants={lineIn(1)}
            className="rounded-md bg-[#2563EB] px-2 py-1 text-[8px] font-medium text-white"
          >
            Exporter
          </motion.div>
        </div>

        {/* Summary cards */}
        <motion.div variants={lineIn(1)} className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[#22C55E]/5 p-2 text-center">
            <div className="text-[7px] text-slate-400">Revenus</div>
            <div className="text-[11px] font-bold text-[#22C55E]">54 200 €</div>
          </div>
          <div className="rounded-lg bg-red-50 p-2 text-center">
            <div className="text-[7px] text-slate-400">Dépenses</div>
            <div className="text-[11px] font-bold text-red-500">8 400 €</div>
          </div>
          <div className="rounded-lg bg-[#2563EB]/5 p-2 text-center">
            <div className="text-[7px] text-slate-400">Net</div>
            <div className="text-[11px] font-bold text-[#2563EB]">45 800 €</div>
          </div>
        </motion.div>

        {/* Bar chart */}
        <motion.div variants={lineIn(2)} className="rounded-lg bg-slate-50 p-2">
          <div className="text-[8px] font-medium text-slate-500 mb-2">Revenus vs Dépenses</div>
          <div className="flex items-end gap-[3px] h-16">
            {months.map((m, i) => (
              <div key={m} className="flex flex-1 flex-col items-center gap-[1px]">
                <div className="flex w-full gap-[1px]" style={{ height: `${revenues[i]}px` }}>
                  <div className="flex-1 rounded-t bg-[#2563EB]/70" style={{ height: `${revenues[i]}px` }} />
                  <div className="flex-1 rounded-t bg-red-300" style={{ height: `${expenses[i]}px` }} />
                </div>
                <span className="text-[6px] text-slate-400">{m}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Rentability row */}
        <motion.div variants={lineIn(3)} className="mt-2 flex items-center justify-between rounded-lg border border-slate-100 p-2">
          <span className="text-[8px] text-slate-500">Rentabilité nette</span>
          <span className="text-[11px] font-bold text-[#22C55E]">6,8 %</span>
        </motion.div>
      </motion.div>

      {/* Export badge */}
      <motion.div
        variants={lineIn(5)}
        className="absolute -right-2 -top-2 rounded-lg bg-white px-2.5 py-1.5 shadow-lg ring-1 ring-slate-100 sm:-right-4"
      >
        <div className="text-[8px] font-medium text-[#2563EB]">📊 Export comptable en 1 clic</div>
      </motion.div>
    </motion.div>
  )
}
