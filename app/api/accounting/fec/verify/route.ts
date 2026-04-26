/**
 * API Route: Verify a FEC file against its manifest
 * POST /api/accounting/fec/verify
 *
 * Body: multipart/form-data with a `file` field containing the FEC .txt
 * (or JSON { sha256: string } if the caller already computed it).
 *
 * Returns whether the SHA-256 of the submitted content matches a manifest
 * stored at export time. Used by the EC portal and the owner export page
 * to guarantee the file in their hands is bit-identical to what TALOK
 * generated.
 */

import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { handleApiError, ApiError } from "@/lib/helpers/api-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ApiError(401, "Non authentifie");

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role")
      .eq("user_id", user.id)
      .single();
    if (
      !profile ||
      (profile.role !== "owner" &&
        profile.role !== "admin" &&
        profile.role !== "agency")
    ) {
      throw new ApiError(403, "Acces refuse");
    }

    let providedHash: string | null = null;
    let computedSize: number | null = null;

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) {
        throw new ApiError(400, "Fichier FEC manquant (champ `file`)");
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      providedHash = createHash("sha256").update(buffer).digest("hex");
      computedSize = buffer.byteLength;
    } else if (contentType.includes("application/json")) {
      const body = (await request.json()) as { sha256?: string };
      if (!body.sha256 || !/^[0-9a-f]{64}$/i.test(body.sha256)) {
        throw new ApiError(400, "SHA-256 invalide (64 caracteres hex requis)");
      }
      providedHash = body.sha256.toLowerCase();
    } else {
      throw new ApiError(
        415,
        "Content-Type attendu: multipart/form-data ou application/json",
      );
    }

    const { data: manifest } = await supabase
      .from("fec_manifests")
      .select(
        "id, entity_id, fec_year, filename, line_count, file_size_bytes, sha256_hex, generated_at, generated_by",
      )
      .eq("sha256_hex", providedHash)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!manifest) {
      return NextResponse.json({
        success: true,
        match: false,
        sha256: providedHash,
        message:
          "Aucun manifeste trouve pour cette empreinte. Le fichier n'a pas ete genere par TALOK ou il a ete modifie.",
      });
    }

    return NextResponse.json({
      success: true,
      match: true,
      sha256: providedHash,
      manifest: {
        id: manifest.id,
        entityId: manifest.entity_id,
        year: manifest.fec_year,
        filename: manifest.filename,
        lineCount: manifest.line_count,
        fileSizeBytes: manifest.file_size_bytes,
        generatedAt: manifest.generated_at,
        generatedBy: manifest.generated_by,
        sizeMatches:
          computedSize === null ||
          Number(manifest.file_size_bytes) === computedSize,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
