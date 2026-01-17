export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/chat/threads/[id]/messages - Récupérer les messages d'un thread
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Vérifier que l'utilisateur a accès au thread
    const { data: thread } = await supabase
      .from("chat_threads")
      .select("id")
      .eq("id", params.id as any)
      .single();

    if (!thread) {
      return NextResponse.json(
        { error: "Thread non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer les messages
    const { data: messages, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("thread_id", params.id as any)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({ messages: (messages || []).reverse() });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat/threads/[id]/messages - Envoyer un message
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const formData = await request.formData();
    const body = formData.get("body") as string;
    const attachments = formData.getAll("attachments") as File[];

    if (!body) {
      return NextResponse.json(
        { error: "Message requis" },
        { status: 400 }
      );
    }

    // Récupérer le profil
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", user.id as any)
      .single();

    if (!profile || !("id" in profile)) {
      return NextResponse.json(
        { error: "Profil non trouvé" },
        { status: 404 }
      );
    }

    // Uploader les pièces jointes si présentes
    const uploadedAttachments: Array<{
      storage_path: string;
      file_name: string;
      mime_type: string;
    }> = [];
    if (attachments && attachments.length > 0) {
      for (const file of attachments) {
        const fileName = `chat/${params.id}/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } =
          await supabase.storage.from("documents").upload(fileName, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        uploadedAttachments.push({
          storage_path: uploadData.path,
          file_name: file.name,
          mime_type: file.type,
        });
      }
    }

    // Créer le message
    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        thread_id: params.id as any,
        sender_user: user.id,
        sender_profile_id: (profile as any).id,
        body,
        attachments: uploadedAttachments,
      } as any)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ message });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

