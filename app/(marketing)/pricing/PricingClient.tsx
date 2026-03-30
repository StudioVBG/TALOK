"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, X, ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TVA_RATES,
  TERRITORY_LABELS,
  calculateTTC,
  formatTVARate,
  type Territory,
} from "@/lib/billing/tva";
import { track } from "@/lib/analytics/posthog";

// ============================================
// TYPES
// ============================================

interface PlanData {
  slug: string;
  name: string;
  description: string;
  tagline: string;
  priceMonthly: number; // centimes HT
  priceYearly: number; // centimes HT
  highlights: string[];
  isPopular: boolean;
  ctaText: string;
  badge?: string;
  trialDays: number;
  maxProperties: number;
  extraPropertyPrice: number;
}

interface ComparisonRow {
  label: string;
  gratuit: boolean | string | number;
  starter: boolean | string | number;
  confort: boolean | string | number;
  pro: boolean | string | number;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface PricingClientProps {
  plans: PlanData[];
  comparisonRows: ComparisonRow[];
  faqItems: FAQItem[];
}

// ============================================
// ANIMATIONS
// ============================================

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

// ============================================
// HELPERS
// ============================================

function formatEur(cents: number): string {
  if (cents === 0) return "Gratuit";
  const amount = cents / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCtaHref(slug: string): string {
  if (slug === "gratuit") return "/signup/plan";
  return `/signup/plan?plan=${slug}`;
}

// ============================================
// TERRITORY SELECTOR
// ============================================

function TerritorySelector({
  value,
  onChange,
}: {
  value: Territory;
  onChange: (t: Territory) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <div className="relative inline-block text-left">
      <button
        id={id}
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition-colors hover:border-[#2563EB]/40 hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Territoire : ${TERRITORY_LABELS[value]}. TVA ${formatTVARate(value)}`}
      >
        <MapPin className="h-3.5 w-3.5" />
        <span>{TERRITORY_LABELS[value]}</span>
        <span className="text-slate-400">
          (TVA {formatTVARate(value)})
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {(Object.keys(TVA_RATES) as Territory[]).map((territory) => (
            <li
              key={territory}
              role="option"
              aria-selected={value === territory}
              tabIndex={0}
              className={cn(
                "flex cursor-pointer items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none",
                value === territory && "bg-[#2563EB]/5 text-[#2563EB]"
              )}
              onClick={() => {
                onChange(territory);
                setOpen(false);
                track("pricing_territory_changed", { territory });
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onChange(territory);
                  setOpen(false);
                }
              }}
            >
              <span>{TERRITORY_LABELS[territory]}</span>
              <span className="text-slate-400">
                TVA {formatTVARate(territory)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ============================================
// BILLING TOGGLE
// ============================================

function BillingToggle({
  isYearly,
  onChange,
}: {
  isYearly: boolean;
  onChange: (yearly: boolean) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Frequence de facturation"
      className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1"
    >
      <button
        role="radio"
        aria-checked={!isYearly}
        onClick={() => onChange(false)}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1",
          !isYearly
            ? "bg-[#2563EB] text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        Mensuel
      </button>
      <button
        role="radio"
        aria-checked={isYearly}
        onClick={() => onChange(true)}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-1",
          isYearly
            ? "bg-[#2563EB] text-white shadow-sm"
            : "text-slate-500 hover:text-slate-700"
        )}
      >
        Annuel
        <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          -20 %
        </span>
      </button>
    </div>
  );
}

// ============================================
// PRICING CARD
// ============================================

function PricingCard({
  plan,
  isYearly,
  territory,
}: {
  plan: PlanData;
  isYearly: boolean;
  territory: Territory;
}) {
  const priceHT = isYearly
    ? Math.round(plan.priceYearly / 12)
    : plan.priceMonthly;
  const priceTTC = plan.priceMonthly === 0 ? 0 : calculateTTC(priceHT, territory);
  const isFree = plan.priceMonthly === 0;
  const tvaRate = TVA_RATES[territory];

  const ariaLabel = isFree
    ? `S'inscrire au plan ${plan.name} gratuitement`
    : `S'inscrire au plan ${plan.name} a ${formatEur(priceTTC)} par mois TTC`;

  return (
    <motion.div
      variants={fadeUp}
      tabIndex={0}
      className={cn(
        "relative flex flex-col rounded-2xl border p-6 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2",
        plan.isPopular
          ? "border-[#2563EB] bg-white ring-2 ring-[#2563EB]/20 shadow-lg shadow-[#2563EB]/10"
          : "border-slate-200 bg-white shadow-sm hover:shadow-md"
      )}
    >
      {plan.badge && (
        <span className="absolute -top-3 left-6 inline-block rounded-full bg-[#2563EB] px-3 py-1 text-[11px] font-semibold text-white">
          {plan.badge}
        </span>
      )}

      <h3 className="font-display text-xl font-bold text-slate-900">
        {plan.name}
      </h3>
      <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>

      {/* Prix */}
      <div className="mt-4">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-4xl font-bold text-slate-900">
            {isFree ? "0 \u20AC" : formatEur(priceTTC)}
          </span>
          {!isFree && (
            <span className="text-sm text-slate-400">/mois</span>
          )}
        </div>

        {!isFree && (
          <p className="mt-1 text-xs text-slate-400">
            {formatEur(priceHT)} HT
            {tvaRate > 0 && (
              <>
                {" "}+ TVA {formatTVARate(territory)} ={" "}
                {formatEur(priceTTC)} TTC
              </>
            )}
            {tvaRate === 0 && " — TVA non applicable"}
          </p>
        )}

        {isYearly && !isFree && (
          <p className="mt-0.5 text-xs font-medium text-emerald-600">
            soit {formatEur(calculateTTC(plan.priceYearly, territory))}/an
          </p>
        )}
      </div>

      {/* Features */}
      <ul className="mt-6 flex-1 space-y-2.5" aria-label={`Fonctionnalites du plan ${plan.name}`}>
        {plan.highlights.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-slate-600"
          >
            <Check
              className="mt-0.5 h-4 w-4 shrink-0 text-[#2563EB]"
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Link
        href={getCtaHref(plan.slug)}
        onClick={() =>
          track("cta_pricing_plan_clicked", {
            plan: plan.slug,
            billing: isYearly ? "yearly" : "monthly",
            territory,
            source: "pricing_page",
          })
        }
        aria-label={ariaLabel}
        className={cn(
          "mt-8 block rounded-xl py-3 text-center text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2",
          plan.isPopular
            ? "bg-[#2563EB] text-white shadow-lg shadow-[#2563EB]/25 hover:bg-[#1D4ED8]"
            : "border border-slate-200 bg-white text-slate-700 hover:border-[#2563EB]/40 hover:text-[#2563EB]"
        )}
      >
        {plan.ctaText}
      </Link>

      {plan.trialDays > 0 && (
        <p className="mt-2 text-center text-xs text-slate-400">
          {plan.trialDays} jours d&apos;essai gratuit
        </p>
      )}
    </motion.div>
  );
}

// ============================================
// COMPARISON TABLE
// ============================================

function ComparisonTable({
  rows,
  planNames,
}: {
  rows: ComparisonRow[];
  planNames: string[];
}) {
  function renderCell(value: boolean | string | number) {
    if (value === true)
      return (
        <Check className="mx-auto h-5 w-5 text-[#2563EB]" aria-label="Inclus" />
      );
    if (value === false)
      return (
        <X className="mx-auto h-5 w-5 text-slate-300" aria-label="Non inclus" />
      );
    return <span className="text-sm text-slate-700">{String(value)}</span>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left" aria-label="Comparaison detaillee des plans">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="py-3 pr-4 text-sm font-medium text-slate-500" scope="col">
              Fonctionnalite
            </th>
            {planNames.map((name) => (
              <th
                key={name}
                className="px-4 py-3 text-center text-sm font-semibold text-slate-900"
                scope="col"
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.label}
              className={cn(
                "border-b border-slate-100",
                i % 2 === 0 && "bg-slate-50/50"
              )}
            >
              <td className="py-3 pr-4 text-sm text-slate-600">{row.label}</td>
              <td className="px-4 py-3 text-center">
                {renderCell(row.gratuit)}
              </td>
              <td className="px-4 py-3 text-center">
                {renderCell(row.starter)}
              </td>
              <td className="px-4 py-3 text-center">
                {renderCell(row.confort)}
              </td>
              <td className="px-4 py-3 text-center">
                {renderCell(row.pro)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// FAQ SECTION
// ============================================

function FAQSection({ items }: { items: FAQItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <dl className="mx-auto max-w-3xl divide-y divide-slate-200">
      {items.map((item, i) => (
        <div key={i} className="py-4">
          <dt>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:rounded-lg focus-visible:ring-offset-2"
              aria-expanded={openIndex === i}
            >
              <span className="text-sm font-medium text-slate-900">
                {item.question}
              </span>
              <ChevronDown
                className={cn(
                  "ml-4 h-4 w-4 shrink-0 text-slate-400 transition-transform",
                  openIndex === i && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
          </dt>
          {openIndex === i && (
            <dd className="mt-2 pr-12 text-sm leading-relaxed text-slate-500">
              {item.answer}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

// ============================================
// MAIN CLIENT COMPONENT
// ============================================

export function PricingClient({
  plans,
  comparisonRows,
  faqItems,
}: PricingClientProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [territory, setTerritory] = useState<Territory>("metropole");

  const planNames = plans.map((p) => p.name);

  return (
    <main className="pb-20 pt-12 md:pb-28 md:pt-20">
      {/* ============================================ */}
      {/* HERO */}
      {/* ============================================ */}
      <section className="container mx-auto max-w-6xl px-4 text-center">
        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl md:text-5xl"
        >
          Un prix simple.{" "}
          <span className="text-[#2563EB]">Pas de mauvaise surprise.</span>
        </motion.h1>
        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mx-auto mt-4 max-w-2xl text-base text-slate-500 md:text-lg"
        >
          Commencez gratuitement avec 1 bien. Montez en gamme quand vous etes
          pret. Premier mois offert sur tous les plans payants, sans engagement.
        </motion.p>

        {/* Controls */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-6"
        >
          <BillingToggle isYearly={isYearly} onChange={setIsYearly} />
          <TerritorySelector value={territory} onChange={setTerritory} />
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* PRICING CARDS */}
      {/* ============================================ */}
      <section
        className="container mx-auto max-w-6xl px-4 pt-12"
        aria-label="Plans tarifaires"
      >
        <motion.div
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          {plans.map((plan) => (
            <PricingCard
              key={plan.slug}
              plan={plan}
              isYearly={isYearly}
              territory={territory}
            />
          ))}
        </motion.div>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-6 text-center text-sm text-slate-400"
        >
          Plans Enterprise pour agences et gestionnaires a partir de
          249&nbsp;&euro;/mois.{" "}
          <Link
            href="mailto:contact@talok.fr"
            className="text-[#2563EB] underline underline-offset-2 hover:text-[#1D4ED8]"
          >
            Contactez-nous
          </Link>
        </motion.p>
      </section>

      {/* ============================================ */}
      {/* SAVINGS COMPARISON (Conversion lever) */}
      {/* ============================================ */}
      <section className="container mx-auto mt-16 max-w-4xl px-4 md:mt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center md:p-8"
        >
          <h2 className="font-display text-lg font-bold text-emerald-900 md:text-xl">
            Economisez par rapport a une agence
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-emerald-700 md:text-base">
            Gerez 5 biens avec Talok Confort :{" "}
            <strong>
              {formatEur(
                calculateTTC(isYearly ? 33600 : 3500 * 12, territory)
              )}
              /an TTC
            </strong>
            . Avec une agence immobiliere :{" "}
            <strong>~2&nbsp;000&nbsp;&euro;/an</strong> en frais de gestion (5-8 %
            des loyers).
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-800">
            Soit jusqu&apos;a 80 % d&apos;economie avec Talok.
          </p>
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* COMPARISON TABLE */}
      {/* ============================================ */}
      <section className="container mx-auto mt-16 max-w-5xl px-4 md:mt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <h2 className="text-center font-display text-2xl font-bold text-slate-900 md:text-3xl">
            Comparaison detaillee
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-500">
            Toutes les fonctionnalites incluses dans chaque plan.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6"
        >
          <ComparisonTable rows={comparisonRows} planNames={planNames} />
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* SOCIAL PROOF (Conversion lever) */}
      {/* ============================================ */}
      <section className="container mx-auto mt-16 max-w-4xl px-4 text-center md:mt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <p className="text-sm font-medium text-slate-500">
            Rejoignez{" "}
            <span className="font-semibold text-[#2563EB]">
              500+ proprietaires
            </span>{" "}
            qui gerent leurs biens avec Talok
          </p>
          <div className="mt-4 flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                className={cn(
                  "h-5 w-5",
                  star <= 4 ? "text-amber-400" : "text-amber-300"
                )}
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
            <span className="ml-2 text-sm text-slate-500">
              4,8/5 note moyenne
            </span>
          </div>
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* FAQ */}
      {/* ============================================ */}
      <section className="container mx-auto mt-16 max-w-5xl px-4 md:mt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <h2 className="text-center font-display text-2xl font-bold text-slate-900 md:text-3xl">
            Questions frequentes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-slate-500">
            Tout ce que vous devez savoir sur nos tarifs.
          </p>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-8"
        >
          <FAQSection items={faqItems} />
        </motion.div>
      </section>

      {/* ============================================ */}
      {/* FINAL CTA */}
      {/* ============================================ */}
      <section className="container mx-auto mt-16 max-w-3xl px-4 text-center md:mt-20">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
        >
          <h2 className="font-display text-2xl font-bold text-slate-900 md:text-3xl">
            Pret a simplifier votre gestion locative ?
          </h2>
          <p className="mt-3 text-sm text-slate-500 md:text-base">
            Inscrivez-vous en 2 minutes. Premier mois offert, sans engagement.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup/plan?plan=confort"
              onClick={() =>
                track("cta_pricing_bottom", {
                  plan: "confort",
                  source: "pricing_page",
                })
              }
              className="inline-flex items-center rounded-xl bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#2563EB]/25 transition-all hover:bg-[#1D4ED8] hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
              aria-label="Essayer Talok Confort gratuitement pendant 1 mois"
            >
              Essayer Confort gratuitement
            </Link>
            <Link
              href="/signup/plan"
              className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-[#2563EB]/40 hover:text-[#2563EB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2"
            >
              Commencer gratuitement
            </Link>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
