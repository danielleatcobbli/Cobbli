// Sends the account-locked email (Brevo template 7).
// Triggered when user_security.failed_attempts reaches 5 (locked_at is set).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendBrevoEmail, corsHeaders } from "../_shared/brevo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const userId: string | undefined = body.user_id ?? body.record?.user_id;
    if (!userId) throw new Error("Missing user_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (!profile?.email) throw new Error("Profile/email not found");

    const result = await sendBrevoEmail({
      templateId: 7,
      to: [{ email: profile.email, name: profile.first_name ?? undefined }],
      params: { first_name: profile.first_name ?? "" },
      tags: ["account-locked"],
    });

    return new Response(JSON.stringify({ ok: true, brevo: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-account-locked error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
