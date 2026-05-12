// Shared Brevo helper for sending transactional emails via Brevo's REST API.
// Uses fetch (Deno-native) instead of @getbrevo/brevo (Node SDK) for compatibility.

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

const SENDER = { name: "Danielle from Cobbli", email: "noreply@cobbli.com" };
const REPLY_TO = { email: "support@cobbli.com" };

export interface SendBrevoEmailOptions {
  templateId: number;
  to: { email: string; name?: string }[];
  params?: Record<string, unknown>;
  tags?: string[];
}

export async function sendBrevoEmail(opts: SendBrevoEmailOptions) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY is not configured");

  const payload = {
    sender: SENDER,
    replyTo: REPLY_TO,
    to: opts.to,
    templateId: opts.templateId,
    params: opts.params ?? {},
    tags: opts.tags,
  };

  const res = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo send failed (${res.status}): ${text}`);
  }
  return res.json();
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};
