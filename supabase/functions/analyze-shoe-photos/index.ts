import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SHOE_TYPES = ["Sneakers", "Boots", "Ankle boots", "Heels", "Flats", "Loafers", "Sandals"];
const COLORS = [
  "Black", "Blue", "Brown", "Cream", "Denim", "Gold", "Green", "Grey",
  "Multi", "Navy", "Orange", "Pattern", "Pink", "Purple", "Red", "Silver",
  "Tan", "White", "Yellow",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const { photoPaths, bucket } = (await req.json()) as { photoPaths?: string[]; bucket?: string };
    if (!Array.isArray(photoPaths) || photoPaths.length === 0) {
      return new Response(JSON.stringify({ error: "photoPaths required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const bucketName = bucket === "pair-photos" ? "pair-photos" : "assessment-uploads";

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const urls: string[] = [];
    for (const p of photoPaths.slice(0, 6)) {
      const { data, error } = await admin.storage
        .from(bucketName)
        .createSignedUrl(p, 60 * 5);
      if (!error && data?.signedUrl) urls.push(data.signedUrl);
    }
    if (urls.length === 0) {
      return new Response(JSON.stringify({ shoeType: null, colors: [], brand: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content: any[] = [
      {
        type: "text",
        text:
          `You are helping classify a pair of shoes from customer photos for a shoe repair service.\n` +
          `Identify, from the photos:\n` +
          `1) shoeType — one of: ${SHOE_TYPES.join(", ")}.\n` +
          `2) colors — Look carefully at the shoe in the image. List ONLY the colors that are clearly and visibly present on the shoe itself — including the upper, sole, laces, and lining if visible. Do not include colors you are uncertain about. Do not guess. If a color is only marginally present or you are not confident it is there, omit it. Return only colors from this exact list: ${COLORS.join(", ")}. Return a maximum of 3 colors. If you can only confidently identify 1 color, return only 1. IMPORTANT: if the shoe has 3 or more distinct colors, return "Multi" as the sole color value instead of listing individual colors.\n` +
          `3) brand — visible brand name if clearly readable, otherwise null.\n` +
          `Reply ONLY with strict JSON: {"shoeType": string|null, "colors": string[], "brand": string|null}.`,
      },
      ...urls.map((u) => ({ type: "image_url", image_url: { url: u } })),
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [{ role: "user", content }],
      }),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      console.error("AI gateway error", aiRes.status, txt);
      if (aiRes.status === 429 || aiRes.status === 402) {
        return new Response(JSON.stringify({ shoeType: null, colors: [], brand: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${aiRes.status}`);
    }
    const json = await aiRes.json();
    const raw: string = json?.choices?.[0]?.message?.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    let parsed: { shoeType?: string | null; colors?: string[]; brand?: string | null } = {};
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
        /* ignore */
      }
    }
    const shoeType = SHOE_TYPES.includes(parsed.shoeType as string) ? parsed.shoeType : null;
    let colors = Array.isArray(parsed.colors)
      ? parsed.colors.filter((c) => COLORS.includes(c)).slice(0, 3)
      : [];
    if (colors.length >= 3) colors = ["Multi"];
    const brand = typeof parsed.brand === "string" && parsed.brand.trim() ? parsed.brand.trim().slice(0, 100) : null;

    return new Response(JSON.stringify({ shoeType, colors, brand }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-shoe-photos error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", shoeType: null, colors: [], brand: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
