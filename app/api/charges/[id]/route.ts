export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// @ts-nocheck
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { chargeSchema } from "@/lib/validations";
import { handleApiError } from "@/lib/helpers/api-error";
import { withApiSecurity, securityPresets } from "@/lib/api-security";

const getHandler = async (request: Request, { params }: { params: { id: string } }) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { data: charge, error } = await supabase
      .from("charges")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) throw error;
    return NextResponse.json({ charge });
  } catch (error: unknown) {
    return handleApiError(error);
  }
};

const putHandler = async (request: Request, { params }: { params: { id: string } }) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validated = chargeSchema.partial().parse(body);

    const { data: charge, error } = await supabase
      .from("charges")
      .update(validated)
      .eq("id", params.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ charge });
  } catch (error: unknown) {
    return handleApiError(error);
  }
};

const deleteHandler = async (request: Request, { params }: { params: { id: string } }) => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { error } = await supabase.from("charges").delete().eq("id", params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
};

export const GET = withApiSecurity(getHandler, securityPresets.authenticated);
export const PUT = withApiSecurity(putHandler, securityPresets.authenticated);
export const DELETE = withApiSecurity(deleteHandler, securityPresets.authenticated);
