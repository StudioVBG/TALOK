export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/copro/fund-calls/[id]/sepa-xml
 * Génère un fichier SEPA pain.008.001.02 (Direct Debit) pour prélever les
 * lignes impayées d'un appel de fonds.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSyndic } from "@/lib/helpers/syndic-auth";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: callId } = await params;

  try {
    const auth = await requireSyndic(request);
    if (auth instanceof NextResponse) return auth;

    const { data: call } = await auth.serviceClient
      .from("copro_fund_calls")
      .select("id, site_id, call_number, period_label, due_date")
      .eq("id", callId)
      .maybeSingle();

    if (!call) {
      return NextResponse.json({ error: "Appel introuvable" }, { status: 404 });
    }

    const siteCheck = await requireSyndic(request, { siteId: (call as { site_id: string }).site_id });
    if (siteCheck instanceof NextResponse) return siteCheck;

    const { data: lines } = await auth.serviceClient
      .from("copro_fund_call_lines")
      .select("id, lot_id, owner_name, amount_cents, paid_cents, payment_status")
      .eq("call_id", callId)
      .in("payment_status", ["pending", "partial", "overdue"]);

    type DueLine = { id: string; owner_name: string | null; amount_cents: number; paid_cents: number };
    const dueLines = (lines ?? [])
      .map((l: unknown) => l as DueLine)
      .filter((l: DueLine) => l.amount_cents - l.paid_cents > 0);

    const totalCents = dueLines.reduce(
      (sum: number, l: DueLine) => sum + (l.amount_cents - l.paid_cents),
      0
    );
    const messageId = `TALOK-${callId.slice(0, 8)}-${Date.now()}`;
    const creationDate = new Date().toISOString();
    const dueDate = (call as { due_date?: string }).due_date ?? new Date().toISOString().split("T")[0];

    const txns = dueLines
      .map((line: DueLine, idx: number) => {
        const amount = ((line.amount_cents - line.paid_cents) / 100).toFixed(2);
        const endToEndId = `${messageId}-${idx + 1}`.slice(0, 35);
        return `      <DrctDbtTxInf>
        <PmtId><EndToEndId>${escapeXml(endToEndId)}</EndToEndId></PmtId>
        <InstdAmt Ccy="EUR">${amount}</InstdAmt>
        <DrctDbtTx><MndtRltdInf><MndtId>MNDT-${escapeXml(line.id.slice(0, 8))}</MndtId><DtOfSgntr>${dueDate}</DtOfSgntr></MndtRltdInf></DrctDbtTx>
        <DbtrAgt><FinInstnId><BIC>NOTPROVIDED</BIC></FinInstnId></DbtrAgt>
        <Dbtr><Nm>${escapeXml(line.owner_name ?? "Copropriétaire")}</Nm></Dbtr>
        <DbtrAcct><Id><IBAN>FR0000000000000000000000000</IBAN></Id></DbtrAcct>
        <RmtInf><Ustrd>Appel ${escapeXml((call as { call_number?: string }).call_number ?? "")} ${escapeXml((call as { period_label?: string }).period_label ?? "")}</Ustrd></RmtInf>
      </DrctDbtTxInf>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(messageId)}</MsgId>
      <CreDtTm>${creationDate}</CreDtTm>
      <NbOfTxs>${dueLines.length}</NbOfTxs>
      <CtrlSum>${(totalCents / 100).toFixed(2)}</CtrlSum>
      <InitgPty><Nm>Talok Syndic</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(messageId)}</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${dueLines.length}</NbOfTxs>
      <CtrlSum>${(totalCents / 100).toFixed(2)}</CtrlSum>
      <PmtTpInf><SvcLvl><Cd>SEPA</Cd></SvcLvl><LclInstrm><Cd>CORE</Cd></LclInstrm><SeqTp>RCUR</SeqTp></PmtTpInf>
      <ReqdColltnDt>${dueDate}</ReqdColltnDt>
      <Cdtr><Nm>Syndic Talok</Nm></Cdtr>
      <CdtrAcct><Id><IBAN>FR0000000000000000000000000</IBAN></Id></CdtrAcct>
      <CdtrAgt><FinInstnId><BIC>NOTPROVIDED</BIC></FinInstnId></CdtrAgt>
${txns}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="sepa-${callId.slice(0, 8)}.xml"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}
