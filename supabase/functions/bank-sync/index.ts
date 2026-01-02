import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Clés secrètes (à configurer dans Supabase Vault)
const GC_SECRET_ID = Deno.env.get("GOCARDLESS_SECRET_ID");
const GC_SECRET_KEY = Deno.env.get("GOCARDLESS_SECRET_KEY");
const API_URL = "https://bankaccountdata.gocardless.com/api/v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    // Vérifier l'auth utilisateur
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const { action, institutionId } = await req.json();

    // 1. Obtenir un token d'accès GoCardless
    const tokenResponse = await fetch(`${API_URL}/token/new/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_id: GC_SECRET_ID, secret_key: GC_SECRET_KEY }),
    });
    const { access } = await tokenResponse.json();

    if (action === "initiate") {
      // 2. Créer un lien de connexion (End User Agreement + Requisition)
      
      // Créer requisition
      const reqResponse = await fetch(`${API_URL}/requisitions/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${access}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          redirect: `${req.headers.get("origin")}/owner/finance/callback`,
          institution_id: institutionId,
          reference: user.id,
        }),
      });

      const requisition = await reqResponse.json();

      // Sauvegarder l'état "pending" en base
      await supabase.from("bank_connections").insert({
        user_id: user.id,
        institution_id: institutionId,
        institution_name: "Pending...", // On mettra à jour au retour
        requisition_id: requisition.id,
        agreement_id: requisition.agreement,
        status: "created",
      });

      return new Response(JSON.stringify({ 
        link: requisition.link, 
        requisition_id: requisition.id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

