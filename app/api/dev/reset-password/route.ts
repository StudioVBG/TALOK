export const dynamic = "force-dynamic";
export const runtime = 'nodejs';

// Route de développement pour réinitialiser les mots de passe
// À SUPPRIMER EN PRODUCTION

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  // Seulement en développement
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("[Reset Password] URL:", supabaseUrl);
    console.log("[Reset Password] Key prefix:", serviceRoleKey?.substring(0, 20));

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ 
        error: "Missing Supabase config",
        hasUrl: !!supabaseUrl,
        hasKey: !!serviceRoleKey
      }, { status: 500 });
    }

    // Créer un client admin avec service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Trouver l'utilisateur par email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error("[Reset Password] List error:", listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
    }

    // Mettre à jour le mot de passe
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: password,
    });

    if (error) {
      console.error("[Reset Password] Update error:", error);
      return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Password reset for ${email}`,
      userId: user.id 
    });

  } catch (error: unknown) {
    console.error("[Reset Password] Exception:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Une erreur est survenue" }, { status: 500 });
  }
}

