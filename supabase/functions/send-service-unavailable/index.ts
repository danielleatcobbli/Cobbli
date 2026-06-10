// Sends the "service unavailable" notification when an admin marks an
// assessment as service_unavailable. Uses inline HTML via Brevo.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendBrevoEmail, corsHeaders } from "../_shared/brevo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const assessmentId: string | undefined =
      body.assessment_id ?? body.record?.id;
    if (!assessmentId) throw new Error("Missing assessment_id");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: assessment, error: aErr } = await supabase
      .from("assessments")
      .select("id, user_id")
      .eq("id", assessmentId)
      .maybeSingle();
    if (aErr || !assessment) throw aErr ?? new Error("Assessment not found");

    const { data: authUser, error: uErr } = await supabase.auth.admin.getUserById(
      assessment.user_id,
    );
    if (uErr || !authUser?.user?.email) throw uErr ?? new Error("User email not found");

    const { data: profile } = await supabase
      .from("profiles")
      .select("first_name")
      .eq("user_id", assessment.user_id)
      .maybeSingle();

    const firstName = profile?.first_name ?? "";
    const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

    const html = `
      <div style="font-family: Arial, sans-serif; color: #3d1700; max-width: 560px; margin: 0 auto; padding: 24px;">
        <h2 style="color:#3d1700;">Thanks for reaching out to Cobbli!</h2>
        <p>${greeting}</p>
        <p>Unfortunately, we don't currently offer the service your item needs. We're always expanding our service lists, so check back soon. No charge has been made.</p>
        <p style="margin-top:24px;">If you have any questions, please contact us at <a href="mailto:support@cobbli.com" style="color:#3d1700;text-decoration:underline;">support@cobbli.com</a>.</p>
        <p>— The Cobbli team</p>
      </div>`;

    const result = await sendBrevoEmail({
      subject: "About your Cobbli repair request",
      htmlContent: html,
      to: [{ email: authUser.user.email, name: firstName }],
      tags: ["service-unavailable"],
    });

    return new Response(JSON.stringify({ ok: true, brevo: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-service-unavailable error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
