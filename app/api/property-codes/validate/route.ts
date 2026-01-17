export const runtime = 'nodejs';

import { NextResponse } from "next/server";
import { propertyCodesService } from "@/features/onboarding/services/property-codes.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Code requis" }, { status: 400 });
    }

    const validation = await propertyCodesService.validatePropertyCode(code);

    return NextResponse.json(validation);
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur serveur" }, { status: 500 });
  }
}

