import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/helpers/auth-helper";

export async function GET(request: Request) {
  try {
    const { error, supabase } = await requireAdmin(request);

    if (error) {
      return NextResponse.json(
        { error: error.message, details: (error as any).details },
        { status: error.status }
      );
    }

    if (!supabase) {
      return NextResponse.json({ error: "Client Supabase indisponible" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");

    if (!table) {
      return NextResponse.json({ error: "Paramètre table requis" }, { status: 400 });
    }

    const { error: queryError } = await supabase.from(table).select("id").limit(1);

    if (queryError && queryError.code !== "PGRST116") {
      return NextResponse.json(
        { exists: false, error: queryError.message },
        { status: 200 }
      );
    }

    return NextResponse.json({ exists: true });
  } catch (error: any) {
    console.error("Error in GET /api/admin/tests/table-exists:", error);
    return NextResponse.json(
      { error: error.message || "Erreur serveur" },
      { status: 500 }
    );
  }
}





