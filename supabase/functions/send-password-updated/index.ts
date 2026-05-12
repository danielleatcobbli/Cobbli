// Sends the password-updated confirmation email via Brevo (template ID set below).
// Triggered by a Supabase Database Webhook on UPDATE of auth.users.
// Fires only when the encrypted_password column changes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendBrevoEmail, corsHeaders } from "../_shared/brevo.ts";

// TODO: Replace with the Brevo template ID once it's created.
const BREVO_TEMPLATE_ID = 0;

interface AuthUserRecord {
  id: string;
  email: string | null;
  encrypted_password: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: AuthUserRecord;
  old_record: AuthUserRecord | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = (await req.json()) as WebhookPayload;

    // Only act on auth.users UPDATE events
    if (
      payload.type !== "UPDATE" ||
      payload.schema !== "auth" ||
      payload.table !== "users"
    ) {
      return new Response(JSON.stringify({ skipped: "not an auth.users update" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newRec = payload.record;
    const oldRec = payload.old_record;

    // Only fire when encrypted_password actually changed
    const passwordChanged =
      !!newRec?.encrypted_password &&
      newRec.encrypted_password !== oldRec?.encrypted_password;

    if (!passwordChanged) {
      return new Response(JSON.stringify({ skipped: "password unchanged" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!newRec.email) {
      return new Response(JSON.stringify({ skipped: "no email on user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!BREVO_TEMPLATE_ID) {
      console.warn(
        "send-password-updated: BREVO_TEMPLATE_ID is not set — skipping send",
      );
      return new Response(
        JSON.stringify({ skipped: "BREVO_TEMPLATE_ID not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", newRec.id)
      .maybeSingle();

    const first_name =
      profile?.first_name ??
      (newRec.raw_user_meta_data?.first_name as string | undefined) ??
      "";

    const result = await sendBrevoEmail({
      templateId: BREVO_TEMPLATE_ID,
      to: [{ email: newRec.email, name: first_name || undefined }],
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
