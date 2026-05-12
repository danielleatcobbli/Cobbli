// Sends the password-updated confirmation email via Brevo (template ID 7).
// Invoked directly from the client immediately after a successful password update.
// Authenticates via the caller's Supabase JWT (Authorization header).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendBrevoEmail, corsHeaders } from "../_shared/brevo.ts";

const BREVO_TEMPLATE_ID = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Identify the caller via their JWT
    const userClient = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser(jwt);
    if (userErr || !userRes?.user?.email) {
      return new Response(JSON.stringify({ error: "invalid user" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userRes.user;
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("first_name")
      .eq("user_id", user.id)
      .maybeSingle();

    const first_name =
      profile?.first_name ??
      (user.user_metadata?.first_name as string | undefined) ??
      "";

    const result = await sendBrevoEmail({
      templateId: BREVO_TEMPLATE_ID,
      to: [{ email: user.email, name: first_name || undefined }],
      params: { first_name },
      tags: ["password-updated"],
    });

    return new Response(JSON.stringify({ ok: true, brevo: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-password-updated error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
