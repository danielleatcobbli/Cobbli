// Sends the walk-up account creation welcome email (Brevo template 6).
// Triggered when an admin creates a new auth user with metadata.created_by = 'admin'.
// Generates a Supabase password setup link and includes it in the template params.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendBrevoEmail, corsHeaders } from "../_shared/brevo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const userId: string | undefined = body.user_id ?? body.record?.user_id ?? body.record?.id;
    if (!userId) throw new Error("Missing user_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull auth user (verify created_by = admin) + profile
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId);
    if (authErr || !authUser?.user) throw authErr ?? new Error("User not found");
    const meta = (authUser.user.user_metadata ?? {}) as Record<string, unknown>;
    if (meta.created_by !== "admin") {
      return new Response(JSON.stringify({ skipped: "not walk-up admin user" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = authUser.user.email!;
    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", userId)
      .maybeSingle();

    // Generate a password setup (recovery) link
    const siteUrl = Deno.env.get("SITE_URL") ?? "https://cobbli.com";
    const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${siteUrl}/reset-password` },
    });
    if (linkErr) throw linkErr;
    const password_setup_link = linkData.properties?.action_link ?? "";

    // Optional walk-up context passed by caller
    const ctx = (body.context ?? {}) as Record<string, unknown>;

    const params = {
      first_name: profile?.first_name ?? (meta.first_name as string) ?? "",
      order_number: ctx.order_number ?? "",
      pair_identifier: ctx.pair_identifier ?? "",
      service_1: ctx.service_1 ?? "",
      service_2: ctx.service_2 ?? "",
      collection_date_window: ctx.collection_date_window ?? "",
      station_name: ctx.station_name ?? "",
      station_address: ctx.station_address ?? "",
      password_setup_link,
    };

    const result = await sendBrevoEmail({
      templateId: 6,
      to: [{ email, name: params.first_name as string }],
      params,
      tags: ["walkup-welcome"],
    });

    return new Response(JSON.stringify({ ok: true, brevo: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-walkup-welcome error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
