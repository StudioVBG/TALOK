import { redirect } from "next/navigation";

/**
 * SOTA 2026 — Redirect Factures vers Loyers & revenus consolidé
 * Les factures sont maintenant accessibles dans la page Loyers & revenus.
 * Ce redirect préserve les bookmarks et liens existants.
 * Les sous-pages /owner/invoices/[id] et /owner/invoices/new restent accessibles.
 */
export default function OwnerInvoicesPage() {
  redirect("/owner/money");
}
